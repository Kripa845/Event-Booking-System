from django.db import transaction

from .models import WaitlistEntry
from bookings.models import Booking


@transaction.atomic
def promote_next_user(event):

    waitlist_entry = (
        WaitlistEntry.objects
        .select_for_update()
        .filter(
            event=event,
            status=WaitlistEntry.Status.WAITING,
        )
        .order_by("position", "joined_at")
        .first()
    )

    if not waitlist_entry:
        return None

    booking = Booking.objects.create(
        user=waitlist_entry.user,
        event=event,
        status=Booking.Status.CONFIRMED,
    )

    waitlist_entry.status = WaitlistEntry.Status.PROMOTED
    waitlist_entry.save(
        update_fields=["status"]
    )

    return booking