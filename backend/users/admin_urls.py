from django.urls import path
from .admin_views import (
    AdminDashboardStatsView,
    AdminPendingOrganizersView,
    AdminApprovedOrganizersView,
    AdminApproveOrganizerView,
    AdminDeclineOrganizerView,
    AdminCustomersView,
    AdminEventsView,
)

urlpatterns = [
    # Stats
    path("admin/stats/",  AdminDashboardStatsView.as_view(),    name="admin_stats"),

    # Organizers
    path("admin/organizers/pending/",              AdminPendingOrganizersView.as_view(),  name="admin_organizers_pending"),
    path("admin/organizers/approved/",             AdminApprovedOrganizersView.as_view(), name="admin_organizers_approved"),
    path("admin/organizers/<int:user_id>/approve/",AdminApproveOrganizerView.as_view(),   name="admin_organizer_approve"),
    path("admin/organizers/<int:user_id>/decline/",AdminDeclineOrganizerView.as_view(),   name="admin_organizer_decline"),

    # Customers
    path("admin/customers/", AdminCustomersView.as_view(), name="admin_customers"),

    # Events (read-only)
    path("admin/events/", AdminEventsView.as_view(), name="admin_events"),
]
