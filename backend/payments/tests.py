import base64
import datetime
import json
import tempfile

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from bookings.models import Booking
from events.models import Event, PromoCode
from tickets.models import Ticket
from users.models import User

from .esewa import _sign
from .models import Payment
from .services import release_expired


def esewa_reply(payment, status="COMPLETE", total=None, tamper=False):
    """Build the ?data= value eSewa sends back, signed with the test secret key."""
    reply = {
        "transaction_code": "000AB12",
        "status": status,
        "total_amount": total or f"{payment.amount:.1f}",
        "transaction_uuid": str(payment.transaction_uuid),
        "product_code": "EPAYTEST",
        "signed_field_names": "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names",
    }
    message = ",".join(f"{k}={reply[k]}" for k in reply["signed_field_names"].split(","))
    reply["signature"] = _sign(message)
    if tamper:
        reply["total_amount"] = "1.0"
    return base64.b64encode(json.dumps(reply).encode()).decode()


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class EsewaPaymentTests(TestCase):

    def setUp(self):
        self.org = User.objects.create_user(email="org@test.com", password="pw", role="ORGANIZER")
        self.alice = User.objects.create_user(email="alice@test.com", password="pw")
        self.bob = User.objects.create_user(email="bob@test.com", password="pw")
        self.event = Event.objects.create(
            organizer=self.org, title="Paid Gig", description="d", location="Kathmandu",
            date=datetime.date.today() + datetime.timedelta(days=5),
            start_time=datetime.time(18), end_time=datetime.time(21),
            capacity=1, price=500, status=Event.Status.PUBLISHED,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def start_payment(self, **extra):
        res = self.client.post("/api/bookings/", {"event": self.event.id, **extra}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        return res, Payment.objects.get(user=self.alice, status=Payment.Status.INITIATED)

    def test_paid_booking_waits_for_payment_with_a_signed_form(self):
        res, payment = self.start_payment()
        self.assertEqual(res.data["status"], "PENDING")
        fields = res.data["payment"]["fields"]
        self.assertEqual(fields["total_amount"], "500")
        self.assertEqual(fields["product_code"], "EPAYTEST")
        self.assertEqual(
            fields["signature"],
            _sign(f"total_amount=500,transaction_uuid={payment.transaction_uuid},product_code=EPAYTEST"),
        )
        # No ticket until paid, but the seat is held.
        self.assertFalse(Ticket.objects.filter(booking__user=self.alice).exists())
        self.assertEqual(self.client.get(f"/api/events/{self.event.id}/").data["available_seats"], 0)
        bob = APIClient()
        bob.force_authenticate(self.bob)
        self.assertEqual(bob.post("/api/bookings/", {"event": self.event.id}).data["error"], "Event is sold out.")

    def test_verified_payment_confirms_and_issues_ticket(self):
        _, payment = self.start_payment()
        res = self.client.post("/api/payments/esewa/verify/", {"data": esewa_reply(payment)})
        self.assertEqual(res.status_code, 200, res.data)
        booking = Booking.objects.get(user=self.alice, event=self.event)
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertTrue(Ticket.objects.filter(booking=booking).exists())
        payment.refresh_from_db()
        self.assertEqual((payment.status, payment.ref_id), (Payment.Status.COMPLETE, "000AB12"))
        # Reloading the success page is harmless.
        self.assertEqual(self.client.post("/api/payments/esewa/verify/", {"data": esewa_reply(payment)}).status_code, 200)

    def test_forged_or_wrong_replies_are_refused(self):
        _, payment = self.start_payment()
        for data in (esewa_reply(payment, tamper=True), esewa_reply(payment, total="1.0"),
                     esewa_reply(payment, status="PENDING"), "not-base64"):
            res = self.client.post("/api/payments/esewa/verify/", {"data": data})
            self.assertEqual(res.status_code, 400)
        self.assertEqual(Booking.objects.get(user=self.alice).status, Booking.Status.PENDING)

    def test_someone_else_cannot_confirm_my_payment(self):
        _, payment = self.start_payment()
        bob = APIClient()
        bob.force_authenticate(self.bob)
        self.assertEqual(bob.post("/api/payments/esewa/verify/", {"data": esewa_reply(payment)}).status_code, 400)

    def test_cancel_releases_seat_and_promo_use(self):
        PromoCode.objects.create(event=self.event, code="HALF", percent_off=50, max_uses=1)
        res, payment = self.start_payment(promo_code="half")
        self.assertEqual(res.data["payment"]["fields"]["total_amount"], "250")
        self.assertEqual(PromoCode.objects.get(code="HALF").uses, 1)

        self.client.post(f"/api/payments/{payment.transaction_uuid}/cancel/")
        self.assertEqual(Booking.objects.get(user=self.alice).status, Booking.Status.CANCELLED)
        self.assertEqual(PromoCode.objects.get(code="HALF").uses, 0)
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, Event.Status.PUBLISHED)

    def test_unpaid_orders_expire_and_cannot_be_confirmed_later(self):
        _, payment = self.start_payment()
        Payment.objects.filter(id=payment.id).update(created_at=timezone.now() - datetime.timedelta(minutes=20))
        Booking.objects.filter(payment=payment).update(booked_at=timezone.now() - datetime.timedelta(minutes=20))
        release_expired()

        self.assertEqual(Booking.objects.get(user=self.alice).status, Booking.Status.CANCELLED)
        res = self.client.post("/api/payments/esewa/verify/", {"data": esewa_reply(payment)})
        self.assertEqual(res.status_code, 400)
        self.assertIn("expired", res.data["error"])

    def test_free_events_skip_payment(self):
        self.event.price = 0
        self.event.save()
        res = self.client.post("/api/bookings/", {"event": self.event.id})
        self.assertEqual(res.data["status"], "CONFIRMED")
        self.assertNotIn("payment", res.data)
        self.assertTrue(Ticket.objects.filter(booking__user=self.alice).exists())

    def test_booking_again_replaces_my_unpaid_order(self):
        _, first = self.start_payment()
        _, second = self.start_payment()
        first.refresh_from_db()
        self.assertEqual(first.status, Payment.Status.FAILED)
        self.assertNotEqual(first.id, second.id)

    def test_paid_order_for_friends_confirms_everyone_after_payment(self):
        self.event.capacity = 5
        self.event.save()
        res, payment = self.start_payment(friends=["bob@test.com"])
        self.assertEqual(res.data["payment"]["fields"]["total_amount"], "1000")
        self.assertFalse(Ticket.objects.exists())

        self.client.post("/api/payments/esewa/verify/", {"data": esewa_reply(payment)})
        self.assertEqual(Ticket.objects.filter(booking__event=self.event).count(), 2)
        self.assertTrue(self.bob.notifications.filter(title__startswith="A friend booked").exists())
