from django.utils import timezone

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification

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
