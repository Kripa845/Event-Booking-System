from django.urls import path

from .dashboard_views import (
    CheckInManifestView,
    CheckInEventsView,
    EventAnnounceView,
    EventPromoCodesView,
    EventStaffRemoveView,
    EventStaffView,
    PromoCodeToggleView,
    EventAttendanceView,
    EventAttendeesView,
    EventStatsView,
    EventTurnoutView,
    OrganizerEventsView,
)


urlpatterns = [
    path("checkin/events/", CheckInEventsView.as_view()),
    path("organizer/events/<int:event_id>/promos/", EventPromoCodesView.as_view()),
    path("organizer/promos/<int:promo_id>/", PromoCodeToggleView.as_view()),
    path("organizer/events/<int:event_id>/staff/", EventStaffView.as_view()),
    path("organizer/events/<int:event_id>/staff/<int:user_id>/", EventStaffRemoveView.as_view()),

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

    path(
        "organizer/events/<int:event_id>/attendance/",
        EventAttendanceView.as_view(),
    ),

    path(
        "organizer/events/<int:event_id>/announce/",
        EventAnnounceView.as_view(),
    ),

    path(
        "organizer/events/<int:event_id>/turnout/",
        EventTurnoutView.as_view(),
    ),

    path(
        "organizer/events/<int:event_id>/checkin-manifest/",
        CheckInManifestView.as_view(),
    ),
]