from django.urls import path

from .views import FollowView, NotificationListView, NotificationReadView

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notifications"),
    path("notifications/read/", NotificationReadView.as_view(), name="notifications_read"),
    path("organizers/<int:organizer_id>/follow/", FollowView.as_view(), name="follow_organizer"),
]
