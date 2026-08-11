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

    # ── Profile extras ────────────────────────────────
    phone   = models.CharField(max_length=20, blank=True)
    bio     = models.TextField(blank=True)
    avatar  = models.ImageField(upload_to="avatars/", blank=True, null=True)
    dob     = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.email} ({self.role})"
