from django.shortcuts import render

# Create your views here.
from django.db import transaction

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from bookings.models import Booking
from events.models import Event

from .models import WaitlistEntry
from .serializers import WaitlistSerializer


class WaitlistViewSet(viewsets.ModelViewSet):

    serializer_class = WaitlistSerializer

    permission_classes = [
        IsAuthenticated
    ]

    def get_queryset(self):

        return WaitlistEntry.objects.filter(
            user=self.request.user
        ).order_by("position")

    def create(self, request, *args, **kwargs):

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

            confirmed_count = Booking.objects.filter(
                event=event,
                status=Booking.Status.CONFIRMED
            ).count()

            if confirmed_count < event.capacity:

                return Response(
                    {
                        "error": "Seats are available. You can book directly."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            already_waiting = WaitlistEntry.objects.filter(
                user=request.user,
                event=event
            ).exists()

            if already_waiting:

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