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

    event_date = serializers.DateField(
        source="event.date",
        read_only=True,
    )

    place_in_line = serializers.SerializerMethodField()

    class Meta:
        model = WaitlistEntry

        fields = [
            "id",
            "user",
            "username",
            "event",
            "event_title",
            "event_date",
            "position",
            "place_in_line",
            "status",
            "joined_at",
        ]

        read_only_fields = [
            "user",
            "event",
            "position",
            "status",
            "joined_at",
        ]


    def get_place_in_line(self, obj):
        """Current place among people still waiting (1 = next to get a seat)."""
        if obj.status != WaitlistEntry.Status.WAITING:
            return None
        ahead = WaitlistEntry.objects.filter(
            event=obj.event,
            status=WaitlistEntry.Status.WAITING,
            position__lt=obj.position,
        ).count()
        return ahead + 1
