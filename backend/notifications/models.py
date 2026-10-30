from django.conf import settings
from django.db import models


class Notification(models.Model):
    """A short in-app message shown under the bell icon."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=120)
    message = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)
    # Optional unique label (e.g. "reminder:42") so the same notice is never sent twice.
    key = models.CharField(max_length=80, blank=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} · {self.title}"


class Follow(models.Model):
    """A user following an organizer, to hear about their new events."""

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following",
    )
    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "organizer"], name="unique_follow"),
        ]

    def __str__(self):
        return f"{self.follower} follows {self.organizer}"
