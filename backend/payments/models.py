import uuid

from django.conf import settings
from django.db import models


class Payment(models.Model):
    """One eSewa payment for an order (your ticket plus any friends' tickets)."""

    class Status(models.TextChoices):
        INITIATED = "INITIATED", "Waiting for payment"
        COMPLETE  = "COMPLETE",  "Paid"
        FAILED    = "FAILED",    "Failed or cancelled"
        EXPIRED   = "EXPIRED",   "Expired"

    transaction_uuid = models.CharField(max_length=64, unique=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    promo_code = models.CharField(max_length=30, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)
    ref_id = models.CharField(max_length=64, blank=True)   # eSewa's transaction code
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.transaction_uuid} · NPR {self.amount} · {self.status}"
