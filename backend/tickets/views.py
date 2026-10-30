from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import CanCheckIn

from . import checkin
from .models import Ticket
from .serializers import TicketSerializer
from .sky import build_sky
from .transfer import TransferError, transfer_ticket

MAX_SYNC_SCANS = 500


class TicketViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = TicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Ticket.objects.filter(
            booking__user=self.request.user
        ).order_by("-created_at")
        
        
    @action(detail=True, methods=["post"], url_path="transfer")
    def transfer(self, request, pk=None):
        """Hand this ticket to another EventHub user: {"email": "friend@example.com"}."""
        try:
            new_booking = transfer_ticket(pk, request.user, request.data.get("email"))
        except TransferError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"Ticket sent to {new_booking.user.username}. Your old QR code no longer works.",
            "recipient": new_booking.user.username,
        })

    @action(detail=False, methods=["get"], url_path="sky")
    def sky(self, request):
        """The user's attended events as stars and constellations."""
        return Response(build_sky(request.user))

    @action(
        detail=False,
        methods=["post"],
        url_path="check-in",
        permission_classes=[CanCheckIn],
    )
    def check_in(self, request):

        ticket_number = request.data.get("ticket_number")

        if not ticket_number:
            return Response(
                {"error": "Ticket number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional so older clients keep working; when sent, tickets for other events are refused.
        event_id = request.data.get("event_id")
        if event_id in ("", None):
            event_id = None
        elif not str(event_id).isdigit():
            return Response(
                {"error": "event_id must be a number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            result, ticket = checkin.check_in_ticket(
                ticket_number.strip(), request.user, event_id=event_id,
            )

        if result != checkin.CHECKED_IN:
            code = {
                checkin.INVALID: status.HTTP_404_NOT_FOUND,
                checkin.NOT_YOURS: status.HTTP_403_FORBIDDEN,
            }.get(result, status.HTTP_400_BAD_REQUEST)
            body = {"error": checkin.MESSAGES[result], "code": result}
            if ticket:
                body["attendee"] = ticket.booking.user.username
                body["checked_in_at"] = ticket.checked_in_at
            return Response(body, status=code)

        return Response(
            {
                "message": checkin.MESSAGES[result],
                "ticket_number": ticket.ticket_number,
                "attendee": ticket.booking.user.username,
                "event": ticket.booking.event.title,
                "checked_in_at": ticket.checked_in_at,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="check-in/sync",
        permission_classes=[CanCheckIn],
    )
    def check_in_sync(self, request):
        """
        Upload scans made while offline: {"event_id": 1, "scans": [{"ticket_number", "scanned_at"}]}.
        Each scan is applied in the order it happened and gets its own result.
        """
        event_id = request.data.get("event_id")
        scans = request.data.get("scans")

        if not event_id or not isinstance(scans, list):
            return Response(
                {"error": "event_id and a list of scans are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(scans) > MAX_SYNC_SCANS:
            return Response(
                {"error": f"Send at most {MAX_SYNC_SCANS} scans at a time."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def when(scan):
            parsed = parse_datetime(str(scan.get("scanned_at") or ""))
            if parsed and timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)
            return parsed

        results = []
        ordered = sorted(scans, key=lambda s: when(s) or timezone.now())

        for scan in ordered:
            number = str(scan.get("ticket_number") or "").strip()
            with transaction.atomic():
                result, ticket = checkin.check_in_ticket(
                    number, request.user, scanned_at=when(scan), event_id=event_id,
                )
            results.append({
                "ticket_number": number,
                "result": result,
                "message": checkin.MESSAGES[result],
                "attendee": ticket.booking.user.username if ticket else None,
                "checked_in_at": ticket.checked_in_at if ticket else None,
            })

        return Response({"results": results})
