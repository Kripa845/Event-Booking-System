import uuid
from io import BytesIO

import qrcode

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