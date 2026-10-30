from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager so email is used for authentication instead of username."""

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        # Auto-generate username from email if not provided
        if not extra.get("username"):
            extra["username"] = email.split("@")[0]
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", "ADMIN")
        extra.setdefault("is_approved", True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):

    class Role(models.TextChoices):
        CUSTOMER  = "CUSTOMER",  "Customer"
        ORGANIZER = "ORGANIZER", "Organizer"
        ADMIN     = "ADMIN",     "Admin"

    # ── Auth ──────────────────────────────────────────
    email = models.EmailField(unique=True)
    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["username"]

    objects = UserManager()

    # ── Role & Approval ───────────────────────────────
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
    )
    is_approved = models.BooleanField(
        default=True,
        help_text="Organizers start False until admin approves.",
    )

    class OrganizerStatus(models.TextChoices):
        PENDING   = "PENDING",   "Pending"
        APPROVED  = "APPROVED",  "Approved"
        REJECTED  = "REJECTED",  "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    # Only meaningful for organizers. Defaults to APPROVED (like is_approved=True) so
    # customers, admins and admin-created organizers are unaffected; public organizer
    # registration always sets PENDING. Change it only through set_organizer_status().
    organizer_status = models.CharField(
        max_length=20,
        choices=OrganizerStatus.choices,
        default=OrganizerStatus.APPROVED,
    )
    status_reason = models.CharField(max_length=255, blank=True)

    # ── Organizer application ─────────────────────────
    organization_name = models.CharField(max_length=150, blank=True)
    organizer_about   = models.TextField(blank=True)

    # ── Profile extras ────────────────────────────────
    phone   = models.CharField(max_length=20, blank=True)
    bio     = models.TextField(blank=True)
    avatar  = models.ImageField(upload_to="avatars/", blank=True, null=True)
    dob     = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)

    def set_organizer_status(self, status, reason=""):
        """The one place organizer status changes; keeps is_approved in sync."""
        self.organizer_status = status
        self.status_reason = reason or ""
        self.is_approved = status == self.OrganizerStatus.APPROVED
        self.save(update_fields=["organizer_status", "status_reason", "is_approved"])

    def organizer_block(self):
        """
        Why this organizer can't use organizer features right now, as (code, message),
        or None if they can. Used by login and by the IsOrganizerOrAdmin permission.
        """
        if self.role != self.Role.ORGANIZER or self.organizer_status == self.OrganizerStatus.APPROVED:
            return None
        reason = f" Reason: {self.status_reason}" if self.status_reason else ""
        if self.organizer_status == self.OrganizerStatus.PENDING:
            return "organizer_pending", "Your organizer account is awaiting admin approval."
        if self.organizer_status == self.OrganizerStatus.REJECTED:
            return "organizer_rejected", "Your organizer application was rejected." + reason
        return "organizer_suspended", "Your organizer account has been suspended." + reason

    def __str__(self):
        return f"{self.email} ({self.role})"
