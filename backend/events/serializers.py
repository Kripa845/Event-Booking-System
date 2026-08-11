from rest_framework import serializers
from .models import Event
from bookings.models import Booking


class EventSerializer(serializers.ModelSerializer):
    available_seats  = serializers.SerializerMethodField()
    organizer_name   = serializers.CharField(source="organizer.username", read_only=True)
    organizer_email  = serializers.CharField(source="organizer.email",    read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model  = Event
        fields = [
            "id", "organizer", "organizer_name", "organizer_email",
            "title", "description", "category", "category_display",
            "tags", "location", "venue",
            "date", "start_time", "end_time",
            "capacity", "price", "status",
            "banner", "image",
            "available_seats",
            "created_at", "updated_at",
        ]
        read_only_fields = ["organizer", "created_at", "updated_at"]

    def get_available_seats(self, obj):
        confirmed = Booking.objects.filter(
            event=obj, status=Booking.Status.CONFIRMED
        ).count()
        return max(obj.capacity - confirmed, 0)
