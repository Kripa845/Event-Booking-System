from django.db import transaction

from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from bookings.models import Booking
from events.models import Event
from events.status import held_seats

from .models import WaitlistEntry
from .serializers import WaitlistSerializer


# Only list, retrieve and create (join) are exposed. Update and delete are left out
# on purpose so entries can't be moved to another event or reordered (PUT/PATCH/DELETE -> 405).
class WaitlistViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):

    serializer_class = WaitlistSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        return WaitlistEntry.objects.filter(
            user=self.request.user
        ).order_by("position")

    def create(self, request, *args, **kwargs):

        if request.user.role == "ORGANIZER":
            return Response(
                {"error": "Organizer accounts can't join waitlists."},
                status=status.HTTP_403_FORBIDDEN
            )

        event_id = request.data.get("event")

        if not event_id:
            return Response(
                {"error": "Event is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():

            event = Event.objects.select_for_update().filter(
                id=event_id
            ).first()

            if not event:
                return Response(
                    {"error": "Event not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            if held_seats(event) < event.capacity:

                return Response(
                    {
                        "error": "Seats are available. You can book directly."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            existing = WaitlistEntry.objects.filter(
                user=request.user,
                event=event
            ).first()

            if existing and existing.status == WaitlistEntry.Status.WAITING:

                return Response(
                    {
                        "error": "You are already on the waitlist."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            position = (
                WaitlistEntry.objects.filter(
                    event=event
                ).count()
                + 1
            )

            if existing:
                # Previously promoted or cancelled: rejoin at the back.
                existing.status = WaitlistEntry.Status.WAITING
                existing.position = position
                existing.save(update_fields=["status", "position"])
                entry = existing
            else:
                entry = WaitlistEntry.objects.create(
                    user=request.user,
                    event=event,
                    position=position,
                )

        serializer = self.get_serializer(entry)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )