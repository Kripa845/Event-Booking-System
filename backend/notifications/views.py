from django.utils import timezone

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User

from .models import Follow, Notification

LATEST = 20


class NotificationListView(APIView):
    """GET /api/notifications/ — the user's latest notifications and how many are unread."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        mine = Notification.objects.filter(user=request.user)
        return Response({
            "unread": mine.filter(read_at__isnull=True).count(),
            "results": [
                {
                    "id": n.id,
                    "title": n.title,
                    "message": n.message,
                    "created_at": n.created_at,
                    "read": n.read_at is not None,
                }
                for n in mine[:LATEST]
            ],
        })


class NotificationReadView(APIView):
    """POST /api/notifications/read/ — mark all of the user's notifications as read."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"message": "All notifications marked as read."})


class FollowView(APIView):
    """
    /api/organizers/<id>/follow/
    GET: am I following, and how many followers.  POST: follow.  DELETE: unfollow.
    """
    permission_classes = [IsAuthenticated]

    def _organizer(self, organizer_id):
        return User.objects.filter(id=organizer_id, role=User.Role.ORGANIZER).first()

    def _state(self, request, organizer):
        return Response({
            "following": Follow.objects.filter(follower=request.user, organizer=organizer).exists(),
            "followers": Follow.objects.filter(organizer=organizer).count(),
        })

    def get(self, request, organizer_id):
        organizer = self._organizer(organizer_id)
        if not organizer:
            return Response({"error": "Organizer not found."}, status=404)
        return self._state(request, organizer)

    def post(self, request, organizer_id):
        organizer = self._organizer(organizer_id)
        if not organizer:
            return Response({"error": "Organizer not found."}, status=404)
        if organizer == request.user:
            return Response({"error": "You can't follow yourself."}, status=400)
        Follow.objects.get_or_create(follower=request.user, organizer=organizer)
        return self._state(request, organizer)

    def delete(self, request, organizer_id):
        organizer = self._organizer(organizer_id)
        if not organizer:
            return Response({"error": "Organizer not found."}, status=404)
        Follow.objects.filter(follower=request.user, organizer=organizer).delete()
        return self._state(request, organizer)
