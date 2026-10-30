"""
eSewa ePay v2: build the signed payment form, and verify eSewa's reply.

eSewa signs with HMAC-SHA256 over "field=value,field=value" for the fields listed
in signed_field_names, using the merchant secret key. Only eSewa and we know the
key, so a reply with a valid signature really came from eSewa.

Defaults are eSewa's public TEST credentials (no real money moves). Real
credentials go in environment variables, never in code.
"""
import base64
import hashlib
import hmac
import json
from decimal import Decimal

from django.conf import settings


def _sign(message):
    digest = hmac.new(settings.ESEWA_SECRET_KEY.encode(), message.encode(), hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def _amount(value):
    """Whole rupees as "800", otherwise two decimals as "799.50"."""
    value = Decimal(value)
    return str(int(value)) if value == value.to_integral() else f"{value:.2f}"


def payment_form(payment):
    """The URL and fields the browser must POST to eSewa to start paying."""
    total = _amount(payment.amount)
    fields = {
        "amount": total,
        "tax_amount": "0",
        "total_amount": total,
        "transaction_uuid": str(payment.transaction_uuid),
        "product_code": settings.ESEWA_PRODUCT_CODE,
        "product_service_charge": "0",
        "product_delivery_charge": "0",
        "success_url": f"{settings.FRONTEND_URL}/payment/esewa/success",
        "failure_url": f"{settings.FRONTEND_URL}/payment/esewa/failure?uuid={payment.transaction_uuid}",
        "signed_field_names": "total_amount,transaction_uuid,product_code",
    }
    fields["signature"] = _sign(
        f"total_amount={total},transaction_uuid={fields['transaction_uuid']},product_code={fields['product_code']}"
    )
    return {"url": settings.ESEWA_FORM_URL, "fields": fields}


class InvalidReply(Exception):
    pass


def decode_reply(data):
    """
    eSewa redirects to success_url?data=<base64 JSON>. Decode it and check the
    signature. Returns the reply dict, or raises InvalidReply.
    """
    try:
        reply = json.loads(base64.b64decode(data).decode())
        names = reply["signed_field_names"].split(",")
        message = ",".join(f"{name}={reply[name]}" for name in names)
    except (ValueError, KeyError, TypeError, AttributeError):
        raise InvalidReply("The payment reply couldn't be read.")

    if not hmac.compare_digest(_sign(message), str(reply.get("signature", ""))):
        raise InvalidReply("The payment reply's signature is invalid.")
    return reply
