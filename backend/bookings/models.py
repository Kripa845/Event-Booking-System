from django.conf import settings
from django.db import models


class Booking(models.Model):

    class Status(models.TextChoices):
        CONFIRMED = "CONFIRMED", "Confirmed"
        CANCELLED = "CANCELLED", "Cancelled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings",
    )

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="bookings",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CONFIRMED,
    )

    booked_at = models.DateTimeField(
        auto_now_add=True
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True
    )

    # What the attendee actually paid (prices can change, e.g. early-bird).
    price_paid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    # Set when this seat was handed over from someone else's booking.
    transferred_from = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="transfers",
    )
    class Meta:
     constraints = [
        # Only one *active* booking per user/event; cancelled rows are kept
        # as history so the user can book again later.
        models.UniqueConstraint(
            fields=["user", "event"],
            condition=models.Q(status="CONFIRMED"),
            name="unique_user_event_booking",
        )
    ]

    def __str__(self):
        return f"{self.user.username} - {self.event.title}"