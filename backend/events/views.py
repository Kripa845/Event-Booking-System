from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from users.permissions import IsOrganizerOrAdmin
from notifications.services import notify_followers

from .announcements import notify_ticket_holders
from .calendar import check_date
from .models import Event
from .pricing import current_price
from .promos import PromoError, apply_promo, find_promo
from .status import OPEN, refresh_sold_out
from .weather import forecast_for, geocode
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

    def get_permissions(self):
        # Creating, editing and deleting events needs an approved organizer (or admin).
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsOrganizerOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        qs   = Event.objects.select_related("organizer")
        user = self.request.user

        # Public sees only PUBLISHED / SOLD_OUT; organizers also see their own events in any
        # status (but not other organizers' drafts); admins see everything.
        if not user.is_authenticated or user.role == "CUSTOMER":
            qs = qs.filter(status__in=OPEN)
        elif user.role == "ORGANIZER":
            qs = qs.filter(Q(status__in=OPEN) | Q(organizer=user))

        # Optional category filter via ?category=WORKSHOP
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category.upper())

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.role not in ["ORGANIZER", "ADMIN"]:
            raise PermissionDenied("Only organizers and admins can create events.")
        event = serializer.save(organizer=self.request.user)
        if event.status == Event.Status.PUBLISHED:
            notify_followers(event)

    def perform_update(self, serializer):
        event = self.get_object()
        if event.organizer != self.request.user and self.request.user.role != "ADMIN":
            raise PermissionDenied("You can only modify your own events.")
        old_status = event.status
        event = serializer.save()
        if event.status == Event.Status.CANCELLED and old_status != Event.Status.CANCELLED:
            notify_ticket_holders(
                event, "Event cancelled 😔",
                f"{event.title} on {event.date:%b %d} has been cancelled by the organizer. Sorry for the trouble.",
                key_prefix=f"cancelled:{event.id}",
            )
        if old_status == Event.Status.DRAFT and event.status == Event.Status.PUBLISHED:
            notify_followers(event)
        refresh_sold_out(event)   # capacity may have changed

    def perform_destroy(self, instance):
        if instance.organizer != self.request.user and self.request.user.role != "ADMIN":
            raise PermissionDenied("You can only delete your own events.")
        instance.delete()

    @action(detail=True, methods=["post"], permission_classes=[IsOrganizerOrAdmin])
    def duplicate(self, request, pk=None):
        """Copy one of your events as a new DRAFT (same details, no bookings)."""
        event = self.get_object()
        if event.organizer != request.user and request.user.role != "ADMIN":
            raise PermissionDenied("You can only duplicate your own events.")

        copy = Event.objects.get(pk=event.pk)
        copy.pk = None                       # saving with no primary key inserts a new row
        copy.title = f"{event.title} (copy)"[:200]
        copy.status = Event.Status.DRAFT
        copy.organizer = event.organizer
        copy.save()
        return Response(self.get_serializer(copy).data, status=201)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="promo-check")
    def promo_check(self, request, pk=None):
        """{code, seats?} -> the discounted price per ticket, or an error."""
        event = self.get_object()
        try:
            seats = max(1, int(request.data.get("seats") or 1))
        except (TypeError, ValueError):
            seats = 1
        try:
            promo = find_promo(event, request.data.get("code"), seats=seats)
        except PromoError as exc:
            return Response({"error": str(exc)}, status=400)
        price = current_price(event)["price"]
        return Response({"code": promo.code, "percent_off": promo.percent_off, "price": apply_promo(price, promo)})

    @action(detail=True, methods=["get"], permission_classes=[AllowAny], url_path="map")
    def map_location(self, request, pk=None):
        """Approximate map point for the event (town-level geocoding, Nepal only)."""
        event = self.get_object()
        try:
            for name in (event.location, event.venue):
                spot = geocode(name) if name and name.strip() else None
                if spot:
                    lat, lon, place = spot
                    return Response({"available": True, "lat": lat, "lon": lon, "place": place})
        except Exception:   # geocoder offline or slow: the page just hides the map
            pass
        return Response({"available": False})

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
