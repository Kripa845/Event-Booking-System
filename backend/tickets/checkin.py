"""
Check-in rules shared by the live scanner and the offline sync endpoint.
"""
from django.utils import timezone

from bookings.models import Booking

from .models import Ticket
from .attendance import record_entry

CHECKED_IN = "checked_in"
INVALID = "invalid"
NOT_YOURS = "not_yours"
WRONG_EVENT = "wrong_event"
CANCELLED = "cancelled"
ALREADY_USED = "already_used"
NOT_CONFIRMED = "not_confirmed"

MESSAGES = {
    CHECKED_IN: "Check-in successful.",
    INVALID: "Invalid ticket.",
    NOT_YOURS: "This ticket is for an event you don't manage.",
    WRONG_EVENT: "This ticket is for a different event.",
    CANCELLED: "This ticket has been cancelled.",
    ALREADY_USED: "This ticket has already been used.",
    NOT_CONFIRMED: "Booking is not confirmed.",
}


def can_manage(user, event):
    """Admins, the event's organizer, or door staff assigned to this event."""
    return (
        user.role == "ADMIN"
        or event.organizer_id == user.id
        or event.staff.filter(user=user).exists()
    )


def check_in_ticket(ticket_number, user, scanned_at=None, event_id=None):
    """
    Validate and apply one check-in. Must run inside a transaction.
    Returns (result_code, ticket_or_None).

    `scanned_at` is when the scan happened (offline scans sync later).
    Re-sending the same offline scan is harmless: a ticket already used at
    exactly that time counts as this scan's success, not a duplicate.
    """
    ticket = (
        Ticket.objects
        .select_for_update()
        .select_related("booking", "booking__event", "booking__user")
        .filter(ticket_number=ticket_number)
        .first()
    )

    if not ticket:
        return INVALID, None

    event = ticket.booking.event

    if not can_manage(user, event):
        return NOT_YOURS, None

    if event_id is not None and event.id != int(event_id):
        return WRONG_EVENT, ticket

    if ticket.status == Ticket.Status.CANCELLED:
        return CANCELLED, ticket

    if ticket.status == Ticket.Status.USED:
        if scanned_at is not None and ticket.checked_in_at == scanned_at:
            return CHECKED_IN, ticket
        return ALREADY_USED, ticket

    if ticket.booking.status != Booking.Status.CONFIRMED:
        return NOT_CONFIRMED, ticket

    now = timezone.now()
    ticket.status = Ticket.Status.USED
    ticket.checked_in_at = min(scanned_at, now) if scanned_at else now
    ticket.save(update_fields=["status", "checked_in_at"])
    record_entry(ticket, ticket.checked_in_at, user)

    return CHECKED_IN, ticket
