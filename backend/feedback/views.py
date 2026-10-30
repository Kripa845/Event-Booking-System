from django.db.models import Avg, Count
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
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
        mine = {f.event_id: f for f in EventFeedback.objects.filter(user=request.user)}
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
                "rating": mine[event.id].rating if event.id in mine else None,
                "comment": mine[event.id].comment if event.id in mine else "",
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

        comment = str(request.data.get("comment") or "").strip()[:500]
        EventFeedback.objects.update_or_create(
            user=request.user, event_id=event_id, defaults={"rating": rating, "comment": comment},
        )
        return Response({"event_id": event_id, "rating": rating, "comment": comment})


class EventReviewsView(APIView):
    """GET /api/events/<id>/reviews/ — public: average rating and the latest written reviews."""

    permission_classes = [AllowAny]

    def get(self, request, event_id):
        feedback = EventFeedback.objects.filter(event_id=event_id).select_related("user")
        summary = feedback.aggregate(avg=Avg("rating"), count=Count("id"))
        written = feedback.exclude(comment="").order_by("-updated_at")[:20]
        return Response({
            "avg_rating": round(summary["avg"], 1) if summary["avg"] else None,
            "ratings": summary["count"],
            "reviews": [
                {"username": f.user.username, "rating": f.rating, "comment": f.comment, "date": f.updated_at}
                for f in written
            ],
        })
