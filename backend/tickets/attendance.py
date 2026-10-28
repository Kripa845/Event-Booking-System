"""
What happens once a ticket is successfully checked in: save who came in and
when, and send the attendee a welcome notification.
"""
from notifications.services import notify

from .models import Attendance


def record_entry(ticket, entered_at, scanned_by):
    booking = ticket.booking
    attendee = booking.user
    event = booking.event

    entry, created = Attendance.objects.get_or_create(
        ticket=ticket,
        defaults={
            "event": event,
            "attendee": attendee,
            "attendee_name": attendee.get_full_name() or attendee.username,
            "entered_at": entered_at,
            "scanned_by": scanned_by,
        },
    )

    if created:
        notify(
            attendee,
            "You're in! 🎉",
            f"Welcome to {event.title}! Your entry has been recorded. Enjoy the event!",
        )

    return entry
