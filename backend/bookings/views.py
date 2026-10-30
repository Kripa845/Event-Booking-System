from django.db import transaction
from django.utils import timezone

from rest_framework.decorators import action
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from waitlist.services import promote_next_user
from events.status import refresh_sold_out

from events.status import PENDING_MINUTES
from payments.esewa import payment_form

from .booking import BookingError, book
from .models import Booking
from .serializers import BookingSerializer


# Only list, retrieve, create and the cancel action are exposed. Update and delete
# are left out on purpose: they would skip the capacity/status checks and the
# waitlist promotion that create() and cancel() enforce (PUT/PATCH/DELETE -> 405).
class BookingViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(
            user=self.request.user
        ).order_by("-booked_at")

    def create(self, request, *args, **kwargs):
        """Book {event} for yourself, optionally with {friends: [emails]} and {promo_code}."""
        try:
            booking, friend_bookings, payment = book(
                request.user,
                request.data.get("event"),
                friends=request.data.get("friends"),
                promo_code=request.data.get("promo_code", ""),
            )
        except BookingError as exc:
            return Response({"error": str(exc)}, status=exc.status)

        data = self.get_serializer(booking).data
        data["friends"] = [b.user.username for b in friend_bookings]
        if payment:
            # The browser posts these fields to eSewa; seats are held while the user pays.
            data["payment"] = payment_form(payment)
            data["amount"] = payment.amount
            data["pay_within_minutes"] = PENDING_MINUTES
        return Response(data, status=status.HTTP_201_CREATED)

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

            if booking.status == Booking.Status.PENDING:
                return Response(
                    {"error": "This booking hasn't been paid yet."},
                    status=status.HTTP_400_BAD_REQUEST,
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
            refresh_sold_out(booking.event)   # back to PUBLISHED if nobody took the seat

        return Response(
            {"message": "Booking cancelled successfully."},
            status=status.HTTP_200_OK,
        )
