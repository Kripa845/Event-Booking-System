
from django.db import models
from django.conf import settings


class WaitlistEntry(models.Model):

    class Status(models.TextChoices):
        WAITING = "WAITING", "Waiting"
        PROMOTED = "PROMOTED", "Promoted"
        CANCELLED = "CANCELLED", "Cancelled"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="waitlist_entries",
    )

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="waitlist_entries",
    )

    position = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WAITING,
    )

    joined_at = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ["position"]

        constraints = [
            models.UniqueConstraint(
                fields=["user", "event"],
                name="unique_waitlist_user_event",
            )
        ]

    def __str__(self):
        return f"{self.user.username} - {self.event.title}"

