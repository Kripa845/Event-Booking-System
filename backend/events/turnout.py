
import math

from django.db.models import Count, Q
from django.utils import timezone

from bookings.models import Booking
from tickets.models import Ticket

from .models import Event

# Used before the platform has any attendance history at all.
DEFAULT_SHOW_RATE = 0.8
# How many "virtual" past bookings a base rate is worth when smoothing.
PRIOR_STRENGTH = 4
# Below this many past bookings platform-wide we don't suggest overbooking.
MIN_HISTORY_FOR_OVERBOOK = 20
# One-sided 95% confidence that shows won't exceed capacity.
OVERBOOK_Z = 1.645


def _past_bookings(exclude_event=None):
    """Confirmed bookings for events that have already happened."""
    qs = Booking.objects.filter(
        status=Booking.Status.CONFIRMED,
        event__date__lt=timezone.now().date(),
    ).exclude(event__status=Event.Status.CANCELLED)

    if exclude_event is not None:
        qs = qs.exclude(event=exclude_event)

    return qs


def _counts(qs):
    agg = qs.aggregate(
        booked=Count("id"),
        attended=Count("id", filter=Q(ticket__status=Ticket.Status.USED)),
    )
    return agg["booked"], agg["attended"]


def _smooth(attended, booked, prior):
    return (attended + PRIOR_STRENGTH * prior) / (booked + PRIOR_STRENGTH)


def risk_level(probability):
    if probability < 0.5:
        return "HIGH"
    if probability < 0.75:
        return "MEDIUM"
    return "LOW"


def safe_overbook(capacity, show_rate):
    """
    Largest number of extra seats we can sell while staying ~95% confident
    that attendance won't exceed capacity (normal approximation to binomial).
    """
    if capacity <= 0 or show_rate >= 1:
        return 0

    extra = 0
    while extra < capacity:
        n = capacity + extra + 1
        mean = n * show_rate
        sd = math.sqrt(n * show_rate * (1 - show_rate))
        if mean + OVERBOOK_Z * sd > capacity:
            break
        extra += 1

    return extra


def predict_turnout(event):

    history = _past_bookings(exclude_event=event)

    total_booked, total_attended = _counts(history)
    global_rate = _smooth(total_attended, total_booked, DEFAULT_SHOW_RATE)

    cat_booked, cat_attended = _counts(
        history.filter(event__category=event.category)
    )
    base_rate = _smooth(cat_attended, cat_booked, global_rate)

    bookings = (
        Booking.objects
        .filter(event=event, status=Booking.Status.CONFIRMED)
        .select_related("user", "ticket")
    )

    user_history = {
        row["user"]: row
        for row in (
            history
            .filter(user__in=bookings.values("user"))
            .values("user")
            .annotate(
                booked=Count("id"),
                attended=Count(
                    "id",
                    filter=Q(ticket__status=Ticket.Status.USED),
                ),
            )
        )
    }

    attendees = []

    for booking in bookings:

        past = user_history.get(booking.user_id, {"booked": 0, "attended": 0})
        probability = _smooth(past["attended"], past["booked"], base_rate)

        if past["booked"]:
            reason = f"Attended {past['attended']} of {past['booked']} past events"
        else:
            reason = "No history yet, using category average"

        ticket = getattr(booking, "ticket", None)

        attendees.append({
            "booking_id": booking.id,
            "username": booking.user.username,
            "email": booking.user.email,
            "show_probability": round(probability, 3),
            "risk": risk_level(probability),
            "past_booked": past["booked"],
            "past_attended": past["attended"],
            "reason": reason,
            "checked_in": bool(ticket and ticket.status == Ticket.Status.USED),
        })

    attendees.sort(key=lambda a: a["show_probability"])

    confirmed = len(attendees)
    expected = sum(a["show_probability"] for a in attendees)
    expected_rate = expected / confirmed if confirmed else base_rate

    enough_history = total_booked >= MIN_HISTORY_FOR_OVERBOOK

    return {
        "event_id": event.id,
        "event": event.title,
        "capacity": event.capacity,
        "confirmed": confirmed,
        "checked_in": sum(a["checked_in"] for a in attendees),
        "expected_attendees": round(expected),
        "expected_no_shows": confirmed - round(expected),
        "expected_show_rate": round(expected_rate, 3),
        "category_show_rate": round(base_rate, 3),
        "history_size": total_booked,
        "enough_history": enough_history,
        "suggested_overbook": (
            safe_overbook(event.capacity, base_rate) if enough_history else 0
        ),
        "attendees": attendees,
    }
