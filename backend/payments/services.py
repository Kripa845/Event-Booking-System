"""
Payment lifecycle.

  book() creates PENDING bookings + an INITIATED payment  ->  user pays on eSewa
  confirm_payment()  : eSewa reply verified  -> bookings CONFIRMED (tickets + emails follow)
  cancel_payment()   : user cancelled on eSewa -> bookings CANCELLED, seats and promo uses released
  release_expired()  : unpaid after PENDING_MINUTES -> same as cancel
"""
import datetime
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from bookings.models import Booking
from events.models import PromoCode
from events.status import PENDING_MINUTES, refresh_sold_out
from notifications.services import notify

from .esewa import InvalidReply, decode_reply
from .models import Payment


class PaymentError(Exception):
    pass


def _release(payment, status):
    """Cancel the order's pending bookings and give back seats and promo uses."""
    pending = Booking.objects.filter(payment=payment, status=Booking.Status.PENDING)
    released = pending.count()
    pending.update(status=Booking.Status.CANCELLED, cancelled_at=timezone.now())
    if payment.promo_code and released:
        promo = PromoCode.objects.select_for_update().filter(event=payment.event, code=payment.promo_code).first()
        if promo:
            promo.uses = max(0, promo.uses - released)
            promo.save(update_fields=["uses"])
    payment.status = status
    payment.save(update_fields=["status"])
    refresh_sold_out(payment.event)


def is_expired(payment):
    return payment.created_at < timezone.now() - datetime.timedelta(minutes=PENDING_MINUTES)


@transaction.atomic
def release_expired(event=None):
    """Release every unpaid order older than PENDING_MINUTES (optionally for one event)."""
    cutoff = timezone.now() - datetime.timedelta(minutes=PENDING_MINUTES)
    stale = Payment.objects.select_for_update().filter(status=Payment.Status.INITIATED, created_at__lt=cutoff)
    if event is not None:
        stale = stale.filter(event=event)
    for payment in stale:
        _release(payment, Payment.Status.EXPIRED)


@transaction.atomic
def confirm_payment(data, user):
    """Verify eSewa's reply and confirm the order. Returns the Payment."""
    try:
        reply = decode_reply(data)
    except InvalidReply as exc:
        raise PaymentError(str(exc))

    payment = Payment.objects.select_for_update().filter(
        transaction_uuid=reply.get("transaction_uuid"), user=user,
    ).first()
    if not payment:
        raise PaymentError("Payment not found.")
    if payment.status == Payment.Status.COMPLETE:
        return payment   # the success page was reloaded; nothing to do
    if reply.get("status") != "COMPLETE":
        raise PaymentError("eSewa says the payment isn't complete.")
    if Decimal(str(reply.get("total_amount", "0")).replace(",", "")) != payment.amount:
        raise PaymentError("The paid amount doesn't match the order.")
    if payment.status != Payment.Status.INITIATED:
        raise PaymentError("This payment expired before it was completed. Please book again.")

    payment.status = Payment.Status.COMPLETE
    payment.ref_id = str(reply.get("transaction_code", ""))[:64]
    payment.completed_at = timezone.now()
    payment.save(update_fields=["status", "ref_id", "completed_at"])

    bookings = Booking.objects.filter(payment=payment, status=Booking.Status.PENDING).select_related("user")
    for booking in bookings:
        booking.status = Booking.Status.CONFIRMED
        booking.save(update_fields=["status"])   # the ticket signal issues the QR ticket
        if booking.user != user:
            notify(booking.user, "A friend booked you a ticket 🎟️",
                   f"{user.username} booked you a seat at {payment.event.title}. Your ticket is in My Tickets.")
    refresh_sold_out(payment.event)
    return payment


@transaction.atomic
def cancel_payment(transaction_uuid, user):
    payment = Payment.objects.select_for_update().filter(transaction_uuid=transaction_uuid, user=user).first()
    if not payment:
        raise PaymentError("Payment not found.")
    if payment.status == Payment.Status.INITIATED:
        _release(payment, Payment.Status.FAILED)
    return payment
