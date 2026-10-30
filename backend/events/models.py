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

    # Early-bird pricing: the first `early_bird_seats` tickets sell at a discount,
    # then the price steps up to the regular `price`.
    early_bird_discount = models.PositiveSmallIntegerField(
        default=0, help_text="Percent off for early-bird tickets (0 = no early bird).",
    )
    early_bird_seats = models.PositiveIntegerField(
        default=0, help_text="How many tickets sell at the early-bird price.",
    )

    # Outdoor events get weather forecasts and rain alerts.
    is_outdoor = models.BooleanField(default=False)

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


class Holiday(models.Model):
    """
    Public holidays / big festivals. Festival dates follow the lunar calendar
    and move every year, so admins keep this list current from the gazette.
    """

    name       = models.CharField(max_length=120)
    name_np    = models.CharField(max_length=120, blank=True)
    start_date = models.DateField()
    end_date   = models.DateField(help_text="Same as start date for one-day holidays.")
    major      = models.BooleanField(
        default=False,
        help_text="Big festivals (e.g. Dashain, Tihar) when many people travel home.",
    )

    class Meta:
        ordering = ["start_date"]

    def __str__(self):
        return f"{self.name} ({self.start_date})"


class PromoCode(models.Model):
    """A discount code an organizer creates for one event, e.g. STUDENT20 = 20% off."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="promo_codes")
    code = models.CharField(max_length=30)                 # stored upper-case
    percent_off = models.PositiveSmallIntegerField()       # 1-100
    max_uses = models.PositiveIntegerField(null=True, blank=True)   # empty = unlimited
    uses = models.PositiveIntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "code"], name="unique_promo_per_event"),
        ]

    def __str__(self):
        return f"{self.code} ({self.percent_off}% off {self.event})"


class EventStaff(models.Model):
    """A helper the organizer allows to scan tickets at the door for one event."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="staff")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="door_events")
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "user"], name="unique_staff_per_event"),
        ]

    def __str__(self):
        return f"{self.user} scans for {self.event}"
