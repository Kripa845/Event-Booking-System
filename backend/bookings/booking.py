"""
Booking rules, for one seat or for you plus friends.

Everything happens in one transaction with the event row locked, so two people
can't grab the last seat at the same time. Booking for friends is all-or-nothing:
if any friend can't be booked, nobody is.

Free orders are confirmed at once. Paid orders are created as PENDING with an
eSewa payment; they hold their seats for PENDING_MINUTES and are confirmed when
the payment is verified (payments/services.py).
"""
from django.db import IntegrityError, transaction

from events.models import Event
from events.pricing import current_price
from events.promos import PromoError, apply_promo, find_promo
from events.status import held_seats, refresh_sold_out
from notifications.services import notify
from payments.models import Payment
from payments.services import cancel_payment, release_expired
from users.models import User

from .models import Booking

MAX_FRIENDS = 5


class BookingError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _friends(buyer, emails):
    """Turn a list of emails into users who may receive a ticket."""
    if not isinstance(emails, list):
        raise BookingError("Friends must be a list of emails.")
    cleaned = []
    for email in emails:
        email = str(email or "").strip().lower()
        if email and email not in cleaned:
            cleaned.append(email)
    if len(cleaned) > MAX_FRIENDS:
        raise BookingError(f"You can book for at most {MAX_FRIENDS} friends at once.")

    friends = []
    for email in cleaned:
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            raise BookingError(f"No EventHub account uses {email}. Ask them to sign up first.")
        if user == buyer:
            raise BookingError("Leave your own email out; your ticket is included.")
        if user.role != User.Role.CUSTOMER:
            raise BookingError(f"{email} isn't a customer account, so it can't hold a ticket.")
        friends.append(user)
    return friends


def book(buyer, event_id, friends=None, promo_code=""):
    """
    Book a seat for `buyer` (and each friend).
    Returns (buyer's booking, friends' bookings, payment or None for free orders).
    """
    if buyer.role == User.Role.ORGANIZER:
        raise BookingError("Organizer accounts can't book tickets.", status=403)
    if not event_id:
        raise BookingError("Event is required.")

    friend_users = _friends(buyer, friends or [])

    try:
        with transaction.atomic():
            event = Event.objects.select_for_update().filter(id=event_id).first()
            if not event:
                raise BookingError("Event not found.", status=404)
            # Free seats from timed-out orders first, and replace your own unpaid order.
            release_expired(event)
            for old in Payment.objects.filter(user=buyer, event=event, status=Payment.Status.INITIATED):
                cancel_payment(old.transaction_uuid, buyer)
            event.refresh_from_db(fields=["status"])   # releasing may have reopened it
            if event.status == Event.Status.SOLD_OUT:
                raise BookingError("Event is sold out.")
            if event.status != Event.Status.PUBLISHED:
                raise BookingError("This event is not open for booking.")


            people = [buyer] + friend_users
            for person in people:
                if Booking.objects.filter(user=person, event=event, status=Booking.Status.CONFIRMED).exists():
                    raise BookingError(
                        "You already have a confirmed booking for this event." if person == buyer
                        else f"{person.username} already has a ticket for this event."
                    )
                if Booking.objects.filter(user=person, event=event, status=Booking.Status.PENDING).exists():
                    raise BookingError(f"{person.username} already has a booking waiting for payment.")

            confirmed = held_seats(event)
            if confirmed + len(people) > event.capacity:
                left = max(event.capacity - confirmed, 0)
                raise BookingError("Event is sold out." if left == 0 else f"Only {left} seat{'s' if left != 1 else ''} left.")

            promo = None
            if promo_code:
                try:
                    promo = find_promo(event, promo_code, seats=len(people), lock=True)
                except PromoError as exc:
                    raise BookingError(str(exc))

            # Each seat is priced in turn, so early-bird seats run out correctly.
            prices = [apply_promo(current_price(event, confirmed + i)["price"], promo) for i in range(len(people))]
            total = sum(prices)
            payment = None
            if total > 0:
                payment = Payment.objects.create(
                    user=buyer, event=event, amount=total, promo_code=promo.code if promo else "",
                )

            bookings = [
                Booking.objects.create(
                    user=person, event=event,
                    status=Booking.Status.PENDING if payment else Booking.Status.CONFIRMED,
                    price_paid=price, promo_code=promo.code if promo else "", payment=payment,
                )
                for person, price in zip(people, prices)
            ]

            if promo:
                promo.uses += len(people)
                promo.save(update_fields=["uses"])
            refresh_sold_out(event)

            if not payment:   # paid orders notify friends once the payment is confirmed
                for friend in friend_users:
                    notify(friend, "A friend booked you a ticket 🎟️",
                           f"{buyer.username} booked you a seat at {event.title}. Your ticket is in My Tickets.")
    except IntegrityError:
        raise BookingError("You already booked this event.")

    return bookings[0], bookings[1:], payment
