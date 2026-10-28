import uuid
from io import BytesIO

import qrcode

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models


class Ticket(models.Model):

    class Status(models.TextChoices):
        VALID = "VALID", "Valid"
        USED = "USED", "Used"
        CANCELLED = "CANCELLED", "Cancelled"

    booking = models.OneToOneField(
        "bookings.Booking",
        on_delete=models.CASCADE,
        related_name="ticket",
    )

    ticket_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
    )

    qr_code = models.ImageField(
        upload_to="tickets/qr/",
        blank=True,
        null=True,
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.VALID,
    )

    checked_in_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def save(self, *args, **kwargs):

        # Generate ticket number if this is a new ticket
        if not self.ticket_number:
            self.ticket_number = (
                f"EVT-{uuid.uuid4().hex[:10].upper()}"
            )

        # Save ticket first
        super().save(*args, **kwargs)

        # Generate QR code if it doesn't exist
        if not self.qr_code:

            qr_data = self.ticket_number

            qr = qrcode.make(qr_data)

            buffer = BytesIO()

            qr.save(
                buffer,
                format="PNG"
            )

            self.qr_code.save(
                f"{self.ticket_number}.png",
                ContentFile(buffer.getvalue()),
                save=False,
            )

            super().save(
                update_fields=["qr_code"]
            )

    def __str__(self):
        return self.ticket_number


class Attendance(models.Model):
    """
    One row per person who actually came in: who it was, which event, and when
    their QR code was scanned. Kept separate from Ticket so the entry log stays
    readable on its own (and keeps the name even if the user renames later).
    """

    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name="attendance",
    )

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="attendance",
    )

    attendee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="attendance",
    )

    attendee_name = models.CharField(max_length=150)

    # When the QR was scanned. Offline scans keep their real scan time.
    entered_at = models.DateTimeField()

    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ["entered_at"]

    def __str__(self):
        return f"{self.attendee_name} entered {self.event} at {self.entered_at:%Y-%m-%d %H:%M}"
