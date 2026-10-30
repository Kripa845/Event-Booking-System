"""Promo codes: look one up and apply it to a price."""
from decimal import ROUND_HALF_UP, Decimal

from .models import PromoCode


class PromoError(Exception):
    pass


def find_promo(event, code, seats=1, lock=False):
    """The active promo for this event with enough uses left for `seats` tickets."""
    code = (code or "").strip().upper()
    qs = PromoCode.objects.select_for_update() if lock else PromoCode.objects
    promo = qs.filter(event=event, code=code, active=True).first()
    if not promo:
        raise PromoError("That promo code isn't valid for this event.")
    if promo.max_uses is not None and promo.uses + seats > promo.max_uses:
        raise PromoError("That promo code has been used up.")
    return promo


def apply_promo(price, promo):
    """Price after the promo discount, rounded to whole rupees like early-bird prices."""
    if not promo:
        return price
    discounted = Decimal(price) * (100 - promo.percent_off) / 100
    return discounted.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
