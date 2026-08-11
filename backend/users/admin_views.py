from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from users.models import User
from events.models import Event
from bookings.models import Booking
from tickets.models import Ticket
from waitlist.models import WaitlistEntry


def admin_only(request):
    """Returns an error Response if user is not ADMIN, else None."""
    if request.user.role != User.Role.ADMIN:
        return Response({"error": "Admin access required."}, status=403)
    return None


# ─────────────────────────────────────────────
#  PLATFORM STATS
# ─────────────────────────────────────────────

class AdminDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = admin_only(request)
        if err:
            return err

        confirmed = Booking.objects.filter(status=Booking.Status.CONFIRMED).count()
        used      = Ticket.objects.filter(status=Ticket.Status.USED).count()

        total_revenue = sum(
            b.event.price
            for b in Booking.objects.filter(
                status=Booking.Status.CONFIRMED
            ).select_related("event")
        )

        return Response({
            "users": {
                "total":      User.objects.count(),
                "customers":  User.objects.filter(role=User.Role.CUSTOMER).count(),
                "organizers": User.objects.filter(role=User.Role.ORGANIZER, is_approved=True).count(),
                "pending":    User.objects.filter(role=User.Role.ORGANIZER, is_approved=False).count(),
                "admins":     User.objects.filter(role=User.Role.ADMIN).count(),
            },
            "events": {
                "total":     Event.objects.count(),
                "published": Event.objects.filter(status=Event.Status.PUBLISHED).count(),
                "draft":     Event.objects.filter(status=Event.Status.DRAFT).count(),
                "completed": Event.objects.filter(status=Event.Status.COMPLETED).count(),
                "cancelled": Event.objects.filter(status=Event.Status.CANCELLED).count(),
            },
            "bookings": {
                "total":     Booking.objects.count(),
                "confirmed": confirmed,
                "cancelled": Booking.objects.filter(status=Booking.Status.CANCELLED).count(),
            },
            "tickets": {
                "total":        Ticket.objects.count(),
                "used":         used,
                "valid":        Ticket.objects.filter(status=Ticket.Status.VALID).count(),
                "checkin_rate": round((used / confirmed * 100) if confirmed > 0 else 0, 1),
            },
            "revenue": {
                "total": float(total_revenue),
            },
            "waitlist": {
                "total": WaitlistEntry.objects.filter(status=WaitlistEntry.Status.WAITING).count(),
            },
        })


# ─────────────────────────────────────────────
#  ORGANIZER APPROVAL
# ─────────────────────────────────────────────

class AdminPendingOrganizersView(APIView):
    """Organizers who registered but are not yet approved."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = admin_only(request)
        if err:
            return err

        users = User.objects.filter(
            role=User.Role.ORGANIZER,
            is_approved=False,
        ).order_by("date_joined")

        return Response([_organizer_dict(u) for u in users])


class AdminApprovedOrganizersView(APIView):
    """Organizers who have been approved."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = admin_only(request)
        if err:
            return err

        users = User.objects.filter(
            role=User.Role.ORGANIZER,
            is_approved=True,
        ).order_by("date_joined")

        return Response([_organizer_dict(u) for u in users])


class AdminApproveOrganizerView(APIView):
    """PATCH /api/admin/organizers/<id>/approve/"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id):
        err = admin_only(request)
        if err:
            return err

        user = User.objects.filter(id=user_id, role=User.Role.ORGANIZER).first()
        if not user:
            return Response({"error": "Organizer not found."}, status=404)

        user.is_approved = True
        user.save(update_fields=["is_approved"])
        return Response({"message": f"{user.username} has been approved."})


class AdminDeclineOrganizerView(APIView):
    """DELETE /api/admin/organizers/<id>/decline/  — removes the pending account."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        err = admin_only(request)
        if err:
            return err

        user = User.objects.filter(
            id=user_id,
            role=User.Role.ORGANIZER,
            is_approved=False,
        ).first()
        if not user:
            return Response({"error": "Pending organizer not found."}, status=404)

        username = user.username
        user.delete()
        return Response({"message": f"Organizer '{username}' has been declined and removed."})


# ─────────────────────────────────────────────
#  CUSTOMERS
# ─────────────────────────────────────────────

class AdminCustomersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = admin_only(request)
        if err:
            return err

        users = User.objects.filter(role=User.Role.CUSTOMER).order_by("-date_joined")

        data = []
        for u in users:
            confirmed = Booking.objects.filter(user=u, status=Booking.Status.CONFIRMED).count()
            cancelled = Booking.objects.filter(user=u, status=Booking.Status.CANCELLED).count()
            data.append({
                "id":               u.id,
                "username":         u.username,
                "email":            u.email,
                "is_active":        u.is_active,
                "date_joined":      u.date_joined,
                "bookings_confirmed": confirmed,
                "bookings_cancelled": cancelled,
            })

        return Response(data)


# ─────────────────────────────────────────────
#  EVENTS (read-only for admin)
# ─────────────────────────────────────────────

class AdminEventsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        err = admin_only(request)
        if err:
            return err

        events = Event.objects.all().select_related("organizer").order_by("-created_at")

        data = []
        for e in events:
            sold       = Booking.objects.filter(event=e, status=Booking.Status.CONFIRMED).count()
            checked_in = Ticket.objects.filter(booking__event=e, status=Ticket.Status.USED).count()
            waitlist   = WaitlistEntry.objects.filter(event=e, status=WaitlistEntry.Status.WAITING).count()

            data.append({
                "id":             e.id,
                "title":          e.title,
                "description":    e.description,
                "organizer_name": e.organizer.username,
                "organizer_id":   e.organizer.id,
                "organizer_email":e.organizer.email,
                "date":           e.date,
                "start_time":     e.start_time,
                "end_time":       e.end_time,
                "location":       e.location,
                "status":         e.status,
                "capacity":       e.capacity,
                "price":          float(e.price),
                "banner":         e.banner.url if e.banner else None,
                "image":          e.image.url if e.image else None,
                "tickets_sold":   sold,
                "available_seats":max(e.capacity - sold, 0),
                "checked_in":     checked_in,
                "waitlist":       waitlist,
                "revenue":        float(sold * e.price),
                "created_at":     e.created_at,
                "updated_at":     e.updated_at,
            })

        return Response(data)


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def _organizer_dict(u):
    events_count  = Event.objects.filter(organizer=u).count()
    revenue       = sum(
        b.event.price
        for b in Booking.objects.filter(
            event__organizer=u, status=Booking.Status.CONFIRMED
        ).select_related("event")
    )
    return {
        "id":           u.id,
        "username":     u.username,
        "email":        u.email,
        "is_approved":  u.is_approved,
        "date_joined":  u.date_joined,
        "events_count": events_count,
        "revenue":      float(revenue),
    }
