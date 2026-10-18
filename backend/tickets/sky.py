"""
"Your Night Sky": every event a user actually attended (ticket scanned at the
door) becomes a star. Stars of the same category join into a constellation
once there are enough of them.
"""
from django.db.models import Count, Q

from bookings.models import Booking
from events.models import Event

from .models import Ticket

# How many attended events of one category it takes to form a constellation.
CONSTELLATION_MIN = 3

CONSTELLATION_NAMES = {
    Event.Category.WORKSHOP:    "The Maker",
    Event.Category.SEMINAR:     "The Scholar",
    Event.Category.HACKATHON:   "The Hacker",
    Event.Category.CONCERT:     "The Lyre",
    Event.Category.CONFERENCE:  "The Speaker",
    Event.Category.SPORTS:      "The Runner",
    Event.Category.FESTIVAL:    "The Lantern",
    Event.Category.COMPETITION: "The Champion",
    Event.Category.MEETUP:      "The Circle",
    Event.Category.OTHER:       "The Wanderer",
}


def build_sky(user):

    tickets = (
        Ticket.objects
        .filter(
            booking__user=user,
            booking__status=Booking.Status.CONFIRMED,
            status=Ticket.Status.USED,
        )
        .select_related("booking__event")
        .annotate(
            # Crowd size makes a star brighter.
            attendees=Count(
                "booking__event__bookings",
                filter=Q(booking__event__bookings__status=Booking.Status.CONFIRMED),
            )
        )
        .order_by("booking__event__date", "checked_in_at")
    )

    stars = []
    counts = {}

    for ticket in tickets:
        event = ticket.booking.event
        counts[event.category] = counts.get(event.category, 0) + 1
        stars.append({
            "ticket_number": ticket.ticket_number,
            "event_id": event.id,
            "title": event.title,
            "category": event.category,
            "category_display": event.get_category_display(),
            "date": event.date,
            "location": event.location,
            "checked_in_at": ticket.checked_in_at,
            "attendees": ticket.attendees,
        })

    constellations = sorted(
        (
            {
                "category": category,
                "name": CONSTELLATION_NAMES.get(category, "The Wanderer"),
                "count": count,
                "formed": count >= CONSTELLATION_MIN,
                "needed": max(CONSTELLATION_MIN - count, 0),
            }
            for category, count in counts.items()
        ),
        key=lambda c: (-c["count"], c["name"]),
    )

    return {
        "stars": stars,
        "constellations": constellations,
        "stats": {
            "stars": len(stars),
            "constellations_formed": sum(c["formed"] for c in constellations),
            "categories": len(counts),
            "first_event": stars[0]["date"] if stars else None,
        },
        "constellation_min": CONSTELLATION_MIN,
    }
