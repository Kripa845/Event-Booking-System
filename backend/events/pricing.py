"""
Early-bird pricing: the first N tickets sell at a discount, then the price
steps up to the regular price. Bookings record what was actually paid.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import DecimalField, F, Sum
from django.db.models.functions import Coalesce

from bookings.models import Booking

EARLY_BIRD = "EARLY_BIRD"
REGULAR = "REGULAR"


def confirmed_count(event):
    """Seats already taken: paid, or held while someone is paying (they count toward early-bird seats)."""
    from .status import held_seats   # imported here to avoid a circular import
    return held_seats(event)


def current_price(event, confirmed=None):
    """The price the next ticket sells at, and why."""
    if confirmed is None:
        confirmed = confirmed_count(event)

    regular = Decimal(event.price)
    early = (
        regular > 0
        and event.early_bird_discount > 0
        and confirmed < event.early_bird_seats
    )
    if early:
        price = (regular * (100 - event.early_bird_discount) / 100).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP,
        )
        return {
            "price": price,
            "tier": EARLY_BIRD,
            "regular_price": regular,
            "discount": event.early_bird_discount,
            "left_at_price": event.early_bird_seats - confirmed,
        }
    return {
        "price": regular,
        "tier": REGULAR,
        "regular_price": regular,
        "discount": 0,
        "left_at_price": None,
    }


def revenue(bookings):
    """Sum of what confirmed bookings paid (older bookings fall back to the event price)."""
    total = bookings.filter(status=Booking.Status.CONFIRMED).aggregate(
        total=Sum(
            Coalesce(F("price_paid"), F("event__price")),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        )
    )["total"]
    return total or Decimal("0")
