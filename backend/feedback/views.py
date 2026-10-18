from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from tickets.models import Ticket

from .models import EventFeedback


def attended_tickets(user):
    """Tickets the user actually used: each one earns a memory postcard."""
    return (
        Ticket.objects
        .filter(
            booking__user=user,
            booking__status=Booking.Status.CONFIRMED,
            status=Ticket.Status.USED,
        )
        .select_related("booking__event")
        .order_by("-checked_in_at")
    )


class PostcardListView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):
        ratings = dict(
            EventFeedback.objects.filter(user=request.user).values_list("event_id", "rating")
        )
        postcards = []
        for ticket in attended_tickets(request.user):
            event = ticket.booking.event
            postcards.append({
                "event_id": event.id,
                "title": event.title,
                "category": event.category,
                "category_display": event.get_category_display(),
                "date": event.date,
                "location": event.location,
                "checked_in_at": ticket.checked_in_at,
                "rating": ratings.get(event.id),
            })
        return Response({"postcards": postcards})


class RateEventView(APIView):

    permission_classes = [IsAuthenticated]

    def post(self, request, event_id):
        try:
            rating = int(request.data.get("rating"))
        except (TypeError, ValueError):
            rating = 0
        if not 1 <= rating <= 5:
            return Response({"error": "Rating must be between 1 and 5."}, status=status.HTTP_400_BAD_REQUEST)

        if not attended_tickets(request.user).filter(booking__event_id=event_id).exists():
            return Response(
                {"error": "You can only rate events you attended."},
                status=status.HTTP_403_FORBIDDEN,
            )

        EventFeedback.objects.update_or_create(
            user=request.user, event_id=event_id, defaults={"rating": rating},
        )
        return Response({"event_id": event_id, "rating": rating})
