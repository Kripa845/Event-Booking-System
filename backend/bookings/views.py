from django.db import transaction, IntegrityError
from django.utils import timezone

from rest_framework.decorators import action
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from waitlist.services import promote_next_user
from events.models import Event

from .models import Booking
from .serializers import BookingSerializer


class BookingViewSet(viewsets.ModelViewSet):

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(
            user=self.request.user
        ).order_by("-booked_at")

    def create(self, request, *args, **kwargs):

        event_id = request.data.get("event")

        if not event_id:
            return Response(
                {"error": "Event is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():

                event = Event.objects.select_for_update().filter(
                    id=event_id
                ).first()

                if not event:
                    return Response(
                        {"error": "Event not found."},
                        status=status.HTTP_404_NOT_FOUND,
                    )

                if event.status != Event.Status.PUBLISHED:
                    return Response(
                        {"error": "This event is not open for booking."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                existing_booking = Booking.objects.filter(
                    user=request.user,
                    event=event,
                    status=Booking.Status.CONFIRMED,
                ).exists()

                if existing_booking:
                    return Response(
                        {"error": "You already have a confirmed booking for this event."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                confirmed_bookings = Booking.objects.filter(
                    event=event,
                    status=Booking.Status.CONFIRMED,
                ).count()

                if confirmed_bookings >= event.capacity:
                    return Response(
                        {"error": "Event is sold out."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                booking = Booking.objects.create(
                    user=request.user,
                    event=event,
                    status=Booking.Status.CONFIRMED,
                )

        except IntegrityError:
            return Response(
                {"error": "You already booked this event."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):

        with transaction.atomic():

            booking = Booking.objects.select_for_update().filter(
                id=pk,
                user=request.user,
            ).first()

            if not booking:
                return Response(
                    {"error": "Booking not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if booking.status == Booking.Status.CANCELLED:
                return Response(
                    {"error": "Booking is already cancelled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            booking.status = Booking.Status.CANCELLED
            booking.cancelled_at = timezone.now()
            booking.save(update_fields=["status", "cancelled_at"])

            if hasattr(booking, "ticket"):
                booking.ticket.status = "CANCELLED"
                booking.ticket.save(update_fields=["status"])

            promote_next_user(booking.event)

        return Response(
            {"message": "Booking cancelled successfully."},
            status=status.HTTP_200_OK,
        )
