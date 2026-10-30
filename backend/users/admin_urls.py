from django.urls import path

from users.models import User
from .admin_views import (
    AdminDashboardStatsView,
    AdminOrganizerListView,
    AdminOrganizerStatusView,
    AdminCreateOrganizerView,
    AdminCustomersView,
    AdminEventsView,
)

S = User.OrganizerStatus

urlpatterns = [
    # Stats
    path("admin/stats/",  AdminDashboardStatsView.as_view(),    name="admin_stats"),

    # Organizers
    path("admin/organizers/pending/",   AdminOrganizerListView.as_view(status_filter=S.PENDING),   name="admin_organizers_pending"),
    path("admin/organizers/approved/",  AdminOrganizerListView.as_view(status_filter=S.APPROVED),  name="admin_organizers_approved"),
    path("admin/organizers/rejected/",  AdminOrganizerListView.as_view(status_filter=S.REJECTED),  name="admin_organizers_rejected"),
    path("admin/organizers/suspended/", AdminOrganizerListView.as_view(status_filter=S.SUSPENDED), name="admin_organizers_suspended"),
    path("admin/organizers/create/",    AdminCreateOrganizerView.as_view(),                        name="admin_organizer_create"),
    path("admin/organizers/<int:user_id>/approve/", AdminOrganizerStatusView.as_view(new_status=S.APPROVED),  name="admin_organizer_approve"),
    path("admin/organizers/<int:user_id>/reject/",  AdminOrganizerStatusView.as_view(new_status=S.REJECTED),  name="admin_organizer_reject"),
    path("admin/organizers/<int:user_id>/suspend/", AdminOrganizerStatusView.as_view(new_status=S.SUSPENDED), name="admin_organizer_suspend"),

    # Customers
    path("admin/customers/", AdminCustomersView.as_view(), name="admin_customers"),

    # Events (read-only)
    path("admin/events/", AdminEventsView.as_view(), name="admin_events"),
]
