from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from users.models import User
from users.organizers import OrganizerError, change_status, create_organizer
from events.models import Event
from bookings.models import Booking
from events.pricing import revenue as paid_revenue
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

        total_revenue = paid_revenue(Booking.objects.all())

        return Response({
            "users": {
                "total":      User.objects.count(),
                "customers":  User.objects.filter(role=User.Role.CUSTOMER).count(),
                "organizers": User.objects.filter(role=User.Role.ORGANIZER, organizer_status=User.OrganizerStatus.APPROVED).count(),
                "pending":    User.objects.filter(role=User.Role.ORGANIZER, organizer_status=User.OrganizerStatus.PENDING).count(),
                "suspended":  User.objects.filter(role=User.Role.ORGANIZER, organizer_status=User.OrganizerStatus.SUSPENDED).count(),
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

class AdminOrganizerListView(APIView):
    """Organizers with one status: GET /api/admin/organizers/<pending|approved|rejected|suspended>/"""
    permission_classes = [IsAuthenticated]
    status_filter = None   # set per URL in admin_urls.py

    def get(self, request):
        err = admin_only(request)
        if err:
            return err

        users = User.objects.filter(
            role=User.Role.ORGANIZER,
            organizer_status=self.status_filter,
        ).order_by("date_joined")

        return Response([_organizer_dict(u) for u in users])


class AdminOrganizerStatusView(APIView):
    """PATCH /api/admin/organizers/<id>/<approve|reject|suspend>/  body: {"reason": "..."} (optional)"""
    permission_classes = [IsAuthenticated]
    new_status = None   # set per URL in admin_urls.py

    def patch(self, request, user_id):
        err = admin_only(request)
        if err:
            return err

        try:
            user = change_status(user_id, self.new_status, request.data.get("reason", ""))
        except OrganizerError as exc:
            return Response({"error": str(exc)}, status=400)

        verb = {"APPROVED": "approved", "REJECTED": "rejected", "SUSPENDED": "suspended"}[self.new_status]
        return Response({"message": f"{user.username} has been {verb}.", "organizer": _organizer_dict(user)})


class AdminCreateOrganizerView(APIView):
    """POST /api/admin/organizers/create/  {email, username, password, organization_name}"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        err = admin_only(request)
        if err:
            return err

        try:
            user = create_organizer(
                request.data.get("email"),
                request.data.get("username"),
                request.data.get("password"),
                request.data.get("organization_name", ""),
            )
        except OrganizerError as exc:
            return Response({"error": str(exc)}, status=400)

        return Response(_organizer_dict(user), status=status.HTTP_201_CREATED)


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
                "revenue":        float(paid_revenue(e.bookings.all())),
                "created_at":     e.created_at,
                "updated_at":     e.updated_at,
            })

        return Response(data)


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def _organizer_dict(u):
    events_count  = Event.objects.filter(organizer=u).count()
    revenue       = paid_revenue(Booking.objects.filter(event__organizer=u))
    return {
        "id":           u.id,
        "username":     u.username,
        "email":        u.email,
        "is_approved":  u.is_approved,
        "organizer_status":  u.organizer_status,
        "status_reason":     u.status_reason,
        "organization_name": u.organization_name,
        "phone":             u.phone,
        "organizer_about":   u.organizer_about,
        "date_joined":  u.date_joined,
        "events_count": events_count,
        "revenue":      float(revenue),
    }
