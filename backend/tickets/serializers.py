from rest_framework import serializers

from .models import Ticket

import qrcode
from io import BytesIO

from django.core.files.base import ContentFile


def generate_ticket_qr(ticket):

    qr_data = str(ticket.ticket_number)

    qr = qrcode.make(qr_data)

    buffer = BytesIO()

    qr.save(
        buffer,
        format="PNG"
    )

    ticket.qr_code.save(
        f"{ticket.ticket_number}.png",
        ContentFile(buffer.getvalue()),
        save=True,
    )
class TicketSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="booking.user.username",
        read_only=True,
    )

    event_title = serializers.CharField(
        source="booking.event.title",
        read_only=True,
    )

    event_date = serializers.DateField(
        source="booking.event.date",
        read_only=True,
    )

    location = serializers.CharField(
        source="booking.event.location",
        read_only=True,
    )

    class Meta:
        model = Ticket

        fields = [
            "id",
            "ticket_number",
            "username",
            "event_title",
            "event_date",
            "location",
            "status",
            "qr_code",
            "checked_in_at",
            "created_at",
        ]

        read_only_fields = fields