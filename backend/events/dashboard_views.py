from django.db.models import Count, Q, Sum

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from bookings.models import Booking
from tickets.models import Ticket
from waitlist.models import WaitlistEntry

from .models import Event


class OrganizerEventsView(APIView):

    permission_classes = [IsAuthenticated]

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
                "tickets_sold": sold,
                "available_seats": max(
                    event.capacity - sold,
                    0
                ),
                "checked_in": checked_in,
                "waitlist": waitlist_count,
            })

        return Response(data)
    
class EventStatsView(APIView):

    permission_classes = [IsAuthenticated]

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

        revenue = confirmed * event.price

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
        })
        
class EventAttendeesView(APIView):

    permission_classes = [IsAuthenticated]

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