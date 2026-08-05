from rest_framework import serializers

from .models import WaitlistEntry


class WaitlistSerializer(serializers.ModelSerializer):

    username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    event_title = serializers.CharField(
        source="event.title",
        read_only=True,
    )

    class Meta:
        model = WaitlistEntry

        fields = [
            "id",
            "user",
            "username",
            "event",
            "event_title",
            "position",
            "joined_at",
        ]

        read_only_fields = [
            "user",
            "position",
            "joined_at",
        ]