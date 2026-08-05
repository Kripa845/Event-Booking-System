from django.db import models

# Create your models here.
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
    class Meta:
     constraints = [
        models.UniqueConstraint(
            fields=["user", "event"],
            name="unique_user_event_booking",
        )
    ]

    def __str__(self):
        return f"{self.user.username} - {self.event.title}"