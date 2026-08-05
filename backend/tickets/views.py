from django.contrib.admin import action
from django.shortcuts import render
from users.permissions import IsOrganizerOrAdmin
# Create your views here.
from rest_framework import viewsets,status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Ticket
from .serializers import TicketSerializer
from datetime import timezone
from django.db import transaction


class TicketViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Ticket.objects.filter(
            booking__user=self.request.user
        ).order_by("-created_at")
        
        
    @action(
        detail=False,
        methods=["post"],
        url_path="check-in",
        permission_classes=[IsOrganizerOrAdmin],
    )
    def check_in(self, request):

        ticket_number = request.data.get("ticket_number")

        if not ticket_number:
            return Response(
                {"error": "Ticket number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():

            ticket = (
                Ticket.objects
                .select_for_update()
                .select_related(
                    "booking",
                    "booking__event",
                    "booking__user",
                )
                .filter(
                    ticket_number=ticket_number
                )
                .first()
            )

            if not ticket:
                return Response(
                    {"error": "Invalid ticket."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if ticket.status == Ticket.Status.CANCELLED:
                return Response(
                    {"error": "This ticket has been cancelled."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ticket.status == Ticket.Status.USED:
                return Response(
                    {"error": "This ticket has already been used."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if ticket.booking.status != "CONFIRMED":
                return Response(
                    {"error": "Booking is not confirmed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ticket.status = Ticket.Status.USED
            ticket.checked_in_at = timezone.now()

            ticket.save(
                update_fields=[
                    "status",
                    "checked_in_at",
                ]
            )

        return Response(
            {
                "message": "Check-in successful.",
                "ticket_number": ticket.ticket_number,
                "attendee": ticket.booking.user.username,
                "event": ticket.booking.event.title,
                "checked_in_at": ticket.checked_in_at,
            },
            status=status.HTTP_200_OK,
        )