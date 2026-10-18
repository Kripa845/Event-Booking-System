from django.utils.dateparse import parse_date
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from users.permissions import IsOrganizerOrAdmin

from .calendar import check_date
from .models import Event
from .weather import forecast_for
from .serializers import EventSerializer as _EventSerializer
from . import smart_search
from .serializers import EventSerializer


class EventViewSet(viewsets.ModelViewSet):
    serializer_class   = EventSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    # Only applies to actions that use ScopedRateThrottle (smart search).
    throttle_scope = "smart_search"

    # Search across title, description, location, venue, tags, organizer email
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ["title", "description", "location", "venue", "tags", "category",
                       "organizer__username", "organizer__email"]
    ordering_fields = ["date", "price", "created_at", "capacity"]
    ordering        = ["-created_at"]

    def get_queryset(self):
        qs   = Event.objects.select_related("organizer")
        user = self.request.user

        # Organizers/admins can see all statuses; public sees only PUBLISHED
        if not (user.is_authenticated and user.role in ["ORGANIZER", "ADMIN"]):
            qs = qs.filter(status=Event.Status.PUBLISHED)

        # Optional category filter via ?category=WORKSHOP
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category.upper())

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.role not in ["ORGANIZER", "ADMIN"]:
            raise PermissionDenied("Only organizers and admins can create events.")
        serializer.save(organizer=self.request.user)

    def perform_update(self, serializer):
        event = self.get_object()
        if event.organizer != self.request.user and self.request.user.role != "ADMIN":
            raise PermissionDenied("You can only modify your own events.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.organizer != self.request.user and self.request.user.role != "ADMIN":
            raise PermissionDenied("You can only delete your own events.")
        instance.delete()

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def weather(self, request, pk=None):
        """Forecast for the event's day and place (Open-Meteo, up to 16 days ahead)."""
        return Response(forecast_for(self.get_object()))

    @action(
        detail=False,
        methods=["get"],
        url_path="date-check",
        permission_classes=[IsOrganizerOrAdmin],
    )
    def date_check(self, request):
        """Holidays and similar events on a date: ?date=2026-10-21&location=...&category=..."""
        date = parse_date(request.query_params.get("date", ""))
        if not date:
            return Response({"error": "A valid date (YYYY-MM-DD) is required."}, status=400)
        return Response(check_date(
            date,
            location=request.query_params.get("location", ""),
            category=request.query_params.get("category", "").upper(),
            exclude_id=request.query_params.get("exclude") or None,
        ))

    @action(
        detail=False,
        methods=["post"],
        url_path="smart-search",
        permission_classes=[AllowAny],
        throttle_classes=[ScopedRateThrottle],
    )
    def smart_search(self, request):
        """Plain-English search: {"query": "free tech workshops this weekend in Lalitpur"}."""
        query = str(request.data.get("query", "")).strip()
        if not query:
            return Response({"error": "Type what you're looking for."}, status=400)
        if len(query) > smart_search.MAX_QUERY_LENGTH:
            return Response({"error": "Please keep it under 200 characters."}, status=400)

        try:
            filters = smart_search.extract_filters(query)
        except smart_search.SmartSearchUnavailable as exc:
            messages = {
                "not_configured": "Smart search isn't set up on this server yet.",
                "busy": "Smart search is busy right now. Try again in a minute.",
                "refused": "Couldn't turn that into a search. Try rephrasing it.",
            }
            return Response(
                {"error": messages.get(str(exc), "Smart search is unavailable right now."), "reason": str(exc)},
                status=503,
            )

        events, relaxed = smart_search.run_filters(filters)
        return Response({
            "filters": filters,
            "relaxed": relaxed,
            "results": _EventSerializer(events[:50], many=True, context={"request": request}).data,
        })
