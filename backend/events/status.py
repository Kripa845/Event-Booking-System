"""
Automatic event status changes.

- PUBLISHED <-> SOLD_OUT follows the seat count (call refresh_sold_out after
  anything that changes confirmed bookings or capacity).
- Events whose date has passed become COMPLETED (run by the daily_tasks command).
Draft, cancelled and completed events are never touched.
"""
import datetime

from django.db.models import Q
from django.utils import timezone

from bookings.models import Booking

from .models import Event

# Statuses the public can see and book or waitlist for.
OPEN = (Event.Status.PUBLISHED, Event.Status.SOLD_OUT)

# How long an unpaid booking holds its seat before it's released.
PENDING_MINUTES = 15


def held_seats(event):
    """Seats taken: confirmed bookings plus unpaid ones that haven't timed out yet."""
    cutoff = timezone.now() - datetime.timedelta(minutes=PENDING_MINUTES)
    return Booking.objects.filter(event=event).filter(
        Q(status=Booking.Status.CONFIRMED) | Q(status=Booking.Status.PENDING, booked_at__gte=cutoff)
    ).count()


def refresh_sold_out(event):
    if event.status not in OPEN:
        return
    new_status = Event.Status.SOLD_OUT if held_seats(event) >= event.capacity else Event.Status.PUBLISHED
    if new_status != event.status:
        event.status = new_status
        event.save(update_fields=["status"])


def complete_past_events():
    """Mark events that have already happened as COMPLETED. Returns how many changed."""
    return Event.objects.filter(
        status__in=[*OPEN, Event.Status.STARTED],
        date__lt=timezone.localdate(),
    ).update(status=Event.Status.COMPLETED)
