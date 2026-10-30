from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from notifications.services import notify
from tickets.checkin import can_manage
from users.models import User
from users.permissions import CanCheckIn, IsOrganizerOrAdmin
from tickets.models import Attendance, Ticket
from waitlist.models import WaitlistEntry

from .announcements import notify_ticket_holders
from .models import Event, EventStaff, PromoCode
from .pricing import revenue as paid_revenue
from .turnout import predict_turnout


def _rating(event):
    feedback = event.feedback.aggregate(avg=Avg("rating"), count=Count("id"))
    return {
        "avg_rating": round(feedback["avg"], 1) if feedback["avg"] else None,
        "ratings": feedback["count"],
    }


class OrganizerEventsView(APIView):

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request):

        if request.user.role not in ["ORGANIZER", "ADMIN"]:
            return Response(
                {"error": "Organizer access required."},
                status=403,
            )

        if request.user.role == "ADMIN":
            events = Event.objects.all()
        else:
            events = Event.objects.filter(
                organizer=request.user
            )

        data = []

        for event in events:

            sold = Booking.objects.filter(
                event=event,
                status=Booking.Status.CONFIRMED,
            ).count()

            checked_in = Ticket.objects.filter(
                booking__event=event,
                status=Ticket.Status.USED,
            ).count()

            waitlist_count = WaitlistEntry.objects.filter(
                event=event
            ).count()

            data.append({
                "id": event.id,
                "title": event.title,
                "date": event.date,
                "location": event.location,
                "capacity": event.capacity,
                "price": event.price,
                "status": event.status,
                "banner": event.banner.url if event.banner else None,
                "image": event.image.url if event.image else None,
                "tickets_sold": sold,
                "available_seats": max(
                    event.capacity - sold,
                    0
                ),
                "checked_in": checked_in,
                "waitlist": waitlist_count,
                "revenue": paid_revenue(event.bookings.all()),
                "category": event.category,
                "is_outdoor": event.is_outdoor,
                "start_time": event.start_time,
                **_rating(event),
            })

        return Response(data)
    
class EventStatsView(APIView):

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request, event_id):

        event = Event.objects.filter(
            id=event_id
        ).first()

        if not event:
            return Response(
                {"error": "Event not found."},
                status=404,
            )

        if (
            request.user.role != "ADMIN"
            and event.organizer != request.user
        ):
            return Response(
                {"error": "You do not own this event."},
                status=403,
            )

        confirmed = Booking.objects.filter(
            event=event,
            status=Booking.Status.CONFIRMED,
        ).count()

        cancelled = Booking.objects.filter(
            event=event,
            status=Booking.Status.CANCELLED,
        ).count()

        checked_in = Ticket.objects.filter(
            booking__event=event,
            status=Ticket.Status.USED,
        ).count()

        waitlist = WaitlistEntry.objects.filter(
            event=event
        ).count()

        revenue = paid_revenue(event.bookings.all())

        feedback = event.feedback.aggregate(avg=Avg("rating"), count=Count("id"))

        no_show = max(
            confirmed - checked_in,
            0
        )

        return Response({
            "event": event.title,
            "capacity": event.capacity,
            "tickets_sold": confirmed,
            "available_seats": max(
                event.capacity - confirmed,
                0
            ),
            "cancelled_bookings": cancelled,
            "checked_in": checked_in,
            "no_show": no_show,
            "waitlist": waitlist,
            "revenue": revenue,
            "avg_rating": round(feedback["avg"], 1) if feedback["avg"] else None,
            "ratings": feedback["count"],
        })
        
class EventAttendeesView(APIView):

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request, event_id):

        event = Event.objects.filter(
            id=event_id
        ).first()

        if not event:
            return Response(
                {"error": "Event not found."},
                status=404,
            )

        if (
            request.user.role != "ADMIN"
            and event.organizer != request.user
        ):
            return Response(
                {"error": "You do not own this event."},
                status=403,
            )

        bookings = Booking.objects.filter(
            event=event
        ).select_related("user")

        data = []

        for booking in bookings:

            ticket = getattr(
                booking,
                "ticket",
                None
            )

            data.append({
                "booking_id": booking.id,
                "username": booking.user.username,
                "email": booking.user.email,
                "booking_status": booking.status,
                "ticket_number": (
                    ticket.ticket_number
                    if ticket
                    else None
                ),
                "ticket_status": (
                    ticket.status
                    if ticket
                    else None
                ),
                "checked_in_at": (
                    ticket.checked_in_at
                    if ticket
                    else None
                ),
                "booked_at": booking.booked_at,
            })

        return Response(data)

class EventAttendanceView(APIView):
    """Entry log: who came in and when their QR was scanned, in order of arrival."""

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request, event_id):

        event = Event.objects.filter(id=event_id).first()

        if not event:
            return Response({"error": "Event not found."}, status=404)

        if request.user.role != "ADMIN" and event.organizer != request.user:
            return Response({"error": "You do not own this event."}, status=403)

        entries = Attendance.objects.filter(event=event).select_related("ticket", "scanned_by")

        return Response([
            {
                "attendee_name": e.attendee_name,
                "ticket_number": e.ticket.ticket_number,
                "entered_at": e.entered_at,
                "scanned_by": e.scanned_by.username if e.scanned_by else None,
            }
            for e in entries
        ])

class EventAnnounceView(APIView):
    """POST /api/organizer/events/<id>/announce/ {"message": "..."} — notify every ticket holder."""

    permission_classes = [IsOrganizerOrAdmin]

    def post(self, request, event_id):

        event = Event.objects.filter(id=event_id).first()

        if not event:
            return Response({"error": "Event not found."}, status=404)

        if request.user.role != "ADMIN" and event.organizer != request.user:
            return Response({"error": "You do not own this event."}, status=403)

        message = str(request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "Write a message first."}, status=400)
        if len(message) > 400:
            return Response({"error": "Keep the message under 400 characters."}, status=400)

        sent = notify_ticket_holders(event, f"📣 {event.title}"[:120], message)
        return Response({"message": f"Sent to {sent} ticket {'holder' if sent == 1 else 'holders'}.", "sent": sent})


class EventTurnoutView(APIView):

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request, event_id):

        event = Event.objects.filter(
            id=event_id
        ).first()

        if not event:
            return Response(
                {"error": "Event not found."},
                status=404,
            )

        if (
            request.user.role != "ADMIN"
            and event.organizer != request.user
        ):
            return Response(
                {"error": "You do not own this event."},
                status=403,
            )

        return Response(predict_turnout(event))


class CheckInManifestView(APIView):
    """Every ticket for one event, so the door can keep checking people in offline."""

    permission_classes = [CanCheckIn]

    def get(self, request, event_id):

        event = Event.objects.filter(
            id=event_id
        ).first()

        if not event:
            return Response(
                {"error": "Event not found."},
                status=404,
            )

        if not can_manage(request.user, event):
            return Response(
                {"error": "You can't check in for this event."},
                status=403,
            )

        tickets = Ticket.objects.filter(
            booking__event=event
        ).select_related("booking__user")

        return Response({
            "event": {
                "id": event.id,
                "title": event.title,
                "date": event.date,
            },
            "generated_at": timezone.now(),
            "tickets": [
                {
                    "ticket_number": t.ticket_number,
                    "attendee": t.booking.user.username,
                    "status": t.status,
                    "checked_in_at": t.checked_in_at,
                }
                for t in tickets
            ],
        })


def _owned_event(request, event_id):
    """(event, None) if the user owns the event (or is admin), else (None, error response)."""
    event = Event.objects.filter(id=event_id).first()
    if not event:
        return None, Response({"error": "Event not found."}, status=404)
    if request.user.role != "ADMIN" and event.organizer != request.user:
        return None, Response({"error": "You do not own this event."}, status=403)
    return event, None


def _promo_dict(p):
    return {"id": p.id, "code": p.code, "percent_off": p.percent_off,
            "max_uses": p.max_uses, "uses": p.uses, "active": p.active}


class EventPromoCodesView(APIView):
    """GET/POST /api/organizer/events/<id>/promos/  {code, percent_off, max_uses?}"""

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request, event_id):
        event, err = _owned_event(request, event_id)
        if err:
            return err
        return Response([_promo_dict(p) for p in event.promo_codes.order_by("-created_at")])

    def post(self, request, event_id):
        event, err = _owned_event(request, event_id)
        if err:
            return err

        code = str(request.data.get("code") or "").strip().upper()
        if not code.isalnum() or len(code) > 30:
            return Response({"error": "Use letters and numbers only (max 30), e.g. STUDENT20."}, status=400)
        try:
            percent = int(request.data.get("percent_off"))
        except (TypeError, ValueError):
            percent = 0
        if not 1 <= percent <= 100:
            return Response({"error": "Discount must be between 1 and 100 percent."}, status=400)
        max_uses = request.data.get("max_uses") or None
        if max_uses is not None:
            try:
                max_uses = int(max_uses)
            except (TypeError, ValueError):
                max_uses = 0
            if max_uses < 1:
                return Response({"error": "Max uses must be at least 1, or left empty."}, status=400)
        if event.promo_codes.filter(code=code).exists():
            return Response({"error": "This event already has that code."}, status=400)

        promo = PromoCode.objects.create(event=event, code=code, percent_off=percent, max_uses=max_uses)
        return Response(_promo_dict(promo), status=201)


class PromoCodeToggleView(APIView):
    """PATCH /api/organizer/promos/<id>/  {active: true|false}"""

    permission_classes = [IsOrganizerOrAdmin]

    def patch(self, request, promo_id):
        promo = PromoCode.objects.filter(id=promo_id).first()
        if not promo:
            return Response({"error": "Promo code not found."}, status=404)
        _, err = _owned_event(request, promo.event_id)
        if err:
            return err
        promo.active = bool(request.data.get("active"))
        promo.save(update_fields=["active"])
        return Response(_promo_dict(promo))


class EventStaffView(APIView):
    """GET/POST /api/organizer/events/<id>/staff/ {email} — people allowed to scan tickets."""

    permission_classes = [IsOrganizerOrAdmin]

    def get(self, request, event_id):
        event, err = _owned_event(request, event_id)
        if err:
            return err
        return Response([
            {"user_id": s.user_id, "username": s.user.username, "email": s.user.email}
            for s in event.staff.select_related("user").order_by("added_at")
        ])

    def post(self, request, event_id):
        event, err = _owned_event(request, event_id)
        if err:
            return err
        email = str(request.data.get("email") or "").strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"error": "No EventHub account uses that email."}, status=400)
        if user.role != User.Role.CUSTOMER:
            return Response({"error": "Door staff must be a customer account."}, status=400)
        _, created = EventStaff.objects.get_or_create(event=event, user=user)
        if created:
            notify(user, "You're on the door team 🎫",
                   f"You can scan tickets for {event.title}. Open Check-In from the menu.")
        return Response({"user_id": user.id, "username": user.username, "email": user.email}, status=201)


class EventStaffRemoveView(APIView):
    """DELETE /api/organizer/events/<id>/staff/<user_id>/"""

    permission_classes = [IsOrganizerOrAdmin]

    def delete(self, request, event_id, user_id):
        event, err = _owned_event(request, event_id)
        if err:
            return err
        EventStaff.objects.filter(event=event, user_id=user_id).delete()
        return Response(status=204)


class CheckInEventsView(APIView):
    """GET /api/checkin/events/ — events this user may scan tickets for (own, staffed, or all for admin)."""

    permission_classes = [CanCheckIn]

    def get(self, request):
        user = request.user
        if user.role == "ADMIN":
            events = Event.objects.all()
        else:
            events = Event.objects.filter(Q(organizer=user) | Q(staff__user=user)).distinct()
        events = events.exclude(status=Event.Status.CANCELLED).order_by("date")
        return Response([
            {"id": e.id, "title": e.title, "date": e.date, "status": e.status,
             "is_owner": e.organizer_id == user.id}
            for e in events
        ])
