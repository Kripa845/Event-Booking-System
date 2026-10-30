from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import PaymentError, cancel_payment, confirm_payment


class EsewaVerifyView(APIView):
    """POST /api/payments/esewa/verify/ {data} — the ?data= value eSewa sent to the success page."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            payment = confirm_payment(request.data.get("data", ""), request.user)
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=400)
        return Response({
            "message": "Payment received. Your tickets are ready!",
            "event_id": payment.event_id,
            "event": payment.event.title,
            "amount": payment.amount,
            "ref_id": payment.ref_id,
        })


class PaymentCancelView(APIView):
    """POST /api/payments/<uuid>/cancel/ — the user backed out on eSewa; free the held seats."""
    permission_classes = [IsAuthenticated]

    def post(self, request, transaction_uuid):
        try:
            cancel_payment(transaction_uuid, request.user)
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=404)
        return Response({"message": "Payment cancelled. Your seat has been released."})
