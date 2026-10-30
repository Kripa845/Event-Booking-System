from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class EventFeedback(models.Model):
    """A 1–5 rating an attendee gives an event after going (from their memory postcard)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_feedback",
    )
    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="feedback",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "event"], name="unique_feedback_per_event"),
        ]

    def __str__(self):
        return f"{self.user} rated {self.event} {self.rating}/5"
