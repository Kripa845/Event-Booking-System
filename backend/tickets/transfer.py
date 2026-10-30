"""
Fair ticket transfer: hand your seat to a friend through the app.

The old booking and ticket are cancelled (so the old QR stops working) and the
friend gets a brand-new booking and ticket at the price originally paid. The
seat count doesn't change, so the waitlist isn't touched.
"""
from django.db import transaction
from django.utils import timezone

from bookings.models import Booking
from events.models import Event
from notifications.services import notify
from users.models import User

from .models import Ticket


class TransferError(Exception):
    pass


@transaction.atomic
def transfer_ticket(ticket_id, sender, recipient_email):

    ticket = (
        Ticket.objects
        .select_for_update()
        .select_related("booking", "booking__event")
        .filter(id=ticket_id, booking__user=sender)
        .first()
    )
    if not ticket:
        raise TransferError("Ticket not found.")

    booking = ticket.booking
    event = booking.event

    if ticket.status != Ticket.Status.VALID or booking.status != Booking.Status.CONFIRMED:
        raise TransferError("Only valid, unused tickets can be transferred.")

    if event.date < timezone.now().date() or event.status not in (
        Event.Status.PUBLISHED, Event.Status.SOLD_OUT,
    ):
        raise TransferError("This event is no longer open, so the ticket can't be transferred.")

    recipient = User.objects.filter(
        email__iexact=(recipient_email or "").strip(), is_active=True,
    ).first()
    if not recipient:
        raise TransferError("No EventHub account uses that email. Ask your friend to sign up first.")
    if recipient == sender:
        raise TransferError("You already hold this ticket.")
    if Booking.objects.filter(
        user=recipient, event=event, status=Booking.Status.CONFIRMED,
    ).exists():
        raise TransferError(f"{recipient.username} already has a ticket for this event.")

    booking.status = Booking.Status.CANCELLED
    booking.cancelled_at = timezone.now()
    booking.save(update_fields=["status", "cancelled_at"])

    ticket.status = Ticket.Status.CANCELLED
    ticket.save(update_fields=["status"])

    notify(
        recipient,
        "You received a ticket 🎁",
        f"{sender.username} sent you their ticket for {event.title}. It's in My Tickets.",
    )

    # A post_save signal issues the new ticket + QR code.
    return Booking.objects.create(
        user=recipient,
        event=event,
        status=Booking.Status.CONFIRMED,
        price_paid=booking.price_paid if booking.price_paid is not None else event.price,
        transferred_from=booking,
    )
