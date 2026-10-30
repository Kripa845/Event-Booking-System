from rest_framework import serializers
from .status import held_seats
from .models import Event
from bookings.models import Booking

from .calendar import holiday_names_on
from .pricing import current_price


class EventSerializer(serializers.ModelSerializer):
    available_seats  = serializers.SerializerMethodField()
    organizer_name   = serializers.CharField(source="organizer.username", read_only=True)
    organizer_email  = serializers.CharField(source="organizer.email",    read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    holidays         = serializers.SerializerMethodField()
    pricing          = serializers.SerializerMethodField()

    class Meta:
        model  = Event
        fields = [
            "id", "organizer", "organizer_name", "organizer_email",
            "title", "description", "category", "category_display",
            "tags", "location", "venue",
            "date", "start_time", "end_time",
            "capacity", "price", "status",
            "early_bird_discount", "early_bird_seats", "pricing", "is_outdoor",
            "banner", "image",
            "available_seats", "holidays",
            "created_at", "updated_at",
        ]
        read_only_fields = ["organizer", "created_at", "updated_at"]

    def get_available_seats(self, obj):
        return max(obj.capacity - held_seats(obj), 0)


    def get_pricing(self, obj):
        return current_price(obj)

    def validate(self, attrs):
        discount = attrs.get("early_bird_discount", getattr(self.instance, "early_bird_discount", 0))
        seats = attrs.get("early_bird_seats", getattr(self.instance, "early_bird_seats", 0))
        capacity = attrs.get("capacity", getattr(self.instance, "capacity", 0))
        if discount > 90:
            raise serializers.ValidationError({"early_bird_discount": "Keep the early-bird discount at 90% or less."})
        if discount and not seats:
            raise serializers.ValidationError({"early_bird_seats": "Say how many tickets get the early-bird price."})
        if capacity and seats > capacity:
            raise serializers.ValidationError({"early_bird_seats": "Can't be more than the event's capacity."})
        return attrs

    def get_holidays(self, obj):
        return holiday_names_on(obj.date) if obj.date else []
