from rest_framework import serializers

from .models import Booking


class BookingSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="user.username",
        read_only=True
    )

    event_title = serializers.CharField(
        source="event.title",
        read_only=True
    )

    class Meta:
        model = Booking

        fields = [
            "id",
            "user",
            "username",
            "event",
            "event_title",
            "status",
            "booked_at",
            "cancelled_at",
        ]

        read_only_fields = [
            "user",
            "status",
            "booked_at",
            "cancelled_at",
        ]