from django.db.migrations import serializer
from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.exceptions import PermissionDenied
from .models import Event
from .serializers import EventSerializer


class EventViewSet(viewsets.ModelViewSet):

    queryset = Event.objects.all().order_by("-created_at")

    serializer_class = EventSerializer

    permission_classes = [
        IsAuthenticatedOrReadOnly
    ]

    def perform_create(self, serializer):
     if self.request.user.role not in [
        "ORGANIZER",
        "ADMIN",
    ]:
        raise PermissionDenied(
            "Only organizers and admins can create events."
        )

     serializer.save(
        organizer=self.request.user
    )
        
    def perform_update(self, serializer):

        event = self.get_object()

        if event.organizer != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You can only modify your own events."
            )

        serializer.save()

    def perform_destroy(self, instance):

        if instance.organizer != self.request.user:

            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "You can only delete your own events."
            )

        instance.delete()