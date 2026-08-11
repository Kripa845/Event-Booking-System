from django.conf import settings
from django.db import models


class Event(models.Model):

    class Status(models.TextChoices):
        DRAFT     = "DRAFT",      "Draft"
        PUBLISHED = "PUBLISHED",  "Published"
        SOLD_OUT  = "SOLD_OUT",   "Sold Out"
        STARTED   = "STARTED",    "Started"
        COMPLETED = "COMPLETED",  "Completed"
        CANCELLED = "CANCELLED",  "Cancelled"

    class Category(models.TextChoices):
        WORKSHOP    = "WORKSHOP",    "Workshop"
        SEMINAR     = "SEMINAR",     "Seminar"
        HACKATHON   = "HACKATHON",   "Hackathon"
        CONCERT     = "CONCERT",     "Concert"
        CONFERENCE  = "CONFERENCE",  "Conference"
        SPORTS      = "SPORTS",      "Sports"
        FESTIVAL    = "FESTIVAL",    "Festival"
        COMPETITION = "COMPETITION", "Competition"
        MEETUP      = "MEETUP",      "Meetup"
        OTHER       = "OTHER",       "Other"

    organizer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="events",
    )

    # ── Core info ────────────────────────────────────
    title       = models.CharField(max_length=200)
    description = models.TextField()
    category    = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    tags        = models.CharField(
        max_length=255, blank=True,
        help_text="Comma-separated tags, e.g. python,django,beginner",
    )

    # ── Location / Venue ─────────────────────────────
    location = models.CharField(max_length=255)
    venue    = models.CharField(max_length=255, blank=True,
                                help_text="Specific venue name, e.g. Hall A, TU Campus")

    # ── Schedule ─────────────────────────────────────
    date       = models.DateField()
    start_time = models.TimeField()
    end_time   = models.TimeField()

    # ── Capacity & Pricing ────────────────────────────
    capacity = models.PositiveIntegerField()
    price    = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # ── Status & Media ────────────────────────────────
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    banner = models.ImageField(upload_to="events/banners/", blank=True, null=True)
    image  = models.ImageField(upload_to="events/", blank=True, null=True)

    # ── Timestamps ────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
