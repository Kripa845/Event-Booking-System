from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied

from .models import Event
from .serializers import EventSerializer


class EventViewSet(viewsets.ModelViewSet):
    serializer_class   = EventSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

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
