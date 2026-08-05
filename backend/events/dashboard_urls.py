from django.urls import path

from .dashboard_views import (
    EventAttendeesView,
    EventStatsView,
    OrganizerEventsView,
)


urlpatterns = [
    path(
        "organizer/events/",
        OrganizerEventsView.as_view(),
    ),

    path(
        "organizer/events/<int:event_id>/stats/",
        EventStatsView.as_view(),
    ),

    path(
        "organizer/events/<int:event_id>/attendees/",
        EventAttendeesView.as_view(),
    ),
]