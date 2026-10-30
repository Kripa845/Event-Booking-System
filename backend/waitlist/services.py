from django.db import transaction

from .models import WaitlistEntry
from bookings.models import Booking
from events.pricing import current_price
from notifications.services import notify


@transaction.atomic
def promote_next_user(event):

    waiting = (
        WaitlistEntry.objects
        .select_for_update()
        .filter(
            event=event,
            status=WaitlistEntry.Status.WAITING,
        )
        .order_by("position", "joined_at")
    )

    for waitlist_entry in waiting:

        # The user may have grabbed a seat directly since joining the
        # waitlist; skip them rather than creating a duplicate booking.
        already_booked = Booking.objects.filter(
            user=waitlist_entry.user,
            event=event,
            status=Booking.Status.CONFIRMED,
        ).exists()

        if already_booked:
            waitlist_entry.status = WaitlistEntry.Status.CANCELLED
            waitlist_entry.save(update_fields=["status"])
            continue

        booking = Booking.objects.create(
            user=waitlist_entry.user,
            event=event,
            status=Booking.Status.CONFIRMED,
            price_paid=current_price(event)["price"],
        )

        waitlist_entry.status = WaitlistEntry.Status.PROMOTED
        waitlist_entry.save(
            update_fields=["status"]
        )

        notify(
            waitlist_entry.user,
            "You got a seat! 🎟️",
            f"A seat opened up for {event.title} and it's yours. Your ticket is in My Tickets.",
        )

        return booking

    return None
