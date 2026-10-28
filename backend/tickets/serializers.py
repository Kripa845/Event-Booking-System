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

    event_id = serializers.IntegerField(
        source="booking.event.id",
        read_only=True,
    )

    is_outdoor = serializers.BooleanField(
        source="booking.event.is_outdoor",
        read_only=True,
    )

    event_start_time = serializers.TimeField(
        source="booking.event.start_time",
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

    venue = serializers.CharField(
        source="booking.event.venue",
        read_only=True,
    )

    event_end_time = serializers.TimeField(
        source="booking.event.end_time",
        read_only=True,
    )

    price_paid = serializers.DecimalField(
        source="booking.price_paid",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    booking_id = serializers.IntegerField(
        source="booking.id",
        read_only=True,
    )

    booking_status = serializers.CharField(
        source="booking.status",
        read_only=True,
    )

    transferred_from = serializers.CharField(
        source="booking.transferred_from.user.username",
        read_only=True,
        default=None,
    )

    transferred_to = serializers.SerializerMethodField()

    class Meta:
        model = Ticket

        fields = [
            "id",
            "booking_id",
            "booking_status",
            "ticket_number",
            "username",
            "event_id",
            "event_title",
            "event_date",
            "event_start_time",
            "is_outdoor",
            "location",
            "venue",
            "event_end_time",
            "price_paid",
            "status",
            "qr_code",
            "checked_in_at",
            "created_at",
            "transferred_from",
            "transferred_to",
        ]

        read_only_fields = fields

    def get_transferred_to(self, obj):
        handed_on = obj.booking.transfers.select_related("user").first()
        return handed_on.user.username if handed_on else None
