import datetime
import tempfile

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from bookings.models import Booking
from events.models import Event

from .models import User

Status = User.OrganizerStatus

ORGANIZER_SIGNUP = {
    "email": "org@test.com",
    "username": "org",
    "password": "Secret123",
    "password2": "Secret123",
    "role": "ORGANIZER",
    "organization_name": "Kathmandu Tech Club",
    "phone": "9800000000",
    "organizer_about": "Monthly hackathons for students.",
}


def login(email, password):
    """Real JWT login, so later requests reload the user from the database."""
    return APIClient().post("/api/auth/login/", {"email": email, "password": password})


def bearer(token):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class OrganizerApprovalTests(TestCase):

    def setUp(self):
        cache.clear()   # the register throttle counts requests in the cache
        self.admin = User.objects.create_superuser(email="admin@test.com", password="pw")
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin)

    def register(self, **changes):
        return APIClient().post("/api/auth/register/", {**ORGANIZER_SIGNUP, **changes}, format="json")

    def organizer(self):
        return User.objects.get(email=ORGANIZER_SIGNUP["email"])

    # 1
    def test_organizer_must_give_application_details(self):
        res = self.register(organization_name="", organizer_about="")
        self.assertEqual(res.status_code, 400)
        self.assertIn("organization_name", res.data)
        self.assertIn("organizer_about", res.data)

    def test_customers_need_no_application_details(self):
        res = APIClient().post("/api/auth/register/", {
            "email": "c@test.com", "username": "c", "password": "Secret123",
            "password2": "Secret123", "role": "CUSTOMER",
        }, format="json")
        self.assertEqual(res.status_code, 201)

    # 2
    def test_admin_role_is_rejected(self):
        res = self.register(role="ADMIN")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(email=ORGANIZER_SIGNUP["email"]).exists())

    # 3
    def test_request_cannot_preapprove_itself(self):
        res = self.register(is_approved=True, organizer_status="APPROVED")
        self.assertEqual(res.status_code, 201)
        org = self.organizer()
        self.assertEqual(org.organizer_status, Status.PENDING)
        self.assertFalse(org.is_approved)

    # 4
    def test_pending_organizer_cannot_log_in(self):
        self.register()
        res = login(ORGANIZER_SIGNUP["email"], ORGANIZER_SIGNUP["password"])
        self.assertEqual(res.status_code, 400)
        self.assertIn("awaiting admin approval", str(res.data))

    # 5
    def test_approved_organizer_can_log_in_and_work(self):
        self.register()
        res = self.admin_client.patch(f"/api/admin/organizers/{self.organizer().id}/approve/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        res = login(ORGANIZER_SIGNUP["email"], ORGANIZER_SIGNUP["password"])
        self.assertEqual(res.status_code, 200)
        self.assertEqual(bearer(res.data["access"]).get("/api/organizer/events/").status_code, 200)

    # 6
    def test_rejected_organizer_sees_reason_and_account_is_kept(self):
        self.register()
        org_id = self.organizer().id
        res = self.admin_client.patch(f"/api/admin/organizers/{org_id}/reject/", {"reason": "No details"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(User.objects.filter(id=org_id).exists())

        res = login(ORGANIZER_SIGNUP["email"], ORGANIZER_SIGNUP["password"])
        self.assertEqual(res.status_code, 400)
        self.assertIn("rejected", str(res.data))
        self.assertIn("No details", str(res.data))

    # 7 and 10
    def test_suspension_blocks_existing_token_and_reapproval_restores_it(self):
        self.register()
        org = self.organizer()
        self.admin_client.patch(f"/api/admin/organizers/{org.id}/approve/")
        token = login(ORGANIZER_SIGNUP["email"], ORGANIZER_SIGNUP["password"]).data["access"]
        client = bearer(token)

        event = Event.objects.create(
            organizer=org, title="E", description="d", location="K",
            date=datetime.date.today() + datetime.timedelta(days=3),
            start_time=datetime.time(10), end_time=datetime.time(12), capacity=5,
            status=Event.Status.PUBLISHED,
        )
        guest = User.objects.create_user(email="g@test.com", password="pw")
        ticket = Booking.objects.create(user=guest, event=event).ticket

        self.admin_client.patch(f"/api/admin/organizers/{org.id}/suspend/", {"reason": "Fake events"})

        res = client.post("/api/events/", {"title": "New"})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data["code"], "organizer_suspended")
        self.assertEqual(client.get(f"/api/organizer/events/{event.id}/attendees/").status_code, 403)
        res = client.post("/api/tickets/check-in/", {"ticket_number": ticket.ticket_number})
        self.assertEqual(res.status_code, 403)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, "VALID")
        self.assertIn("suspended", str(login(ORGANIZER_SIGNUP["email"], ORGANIZER_SIGNUP["password"]).data))

        self.admin_client.patch(f"/api/admin/organizers/{org.id}/approve/")
        self.assertEqual(client.get(f"/api/organizer/events/{event.id}/attendees/").status_code, 200)

    # 8
    def test_customer_cannot_use_admin_or_organizer_endpoints(self):
        customer = APIClient()
        customer.force_authenticate(User.objects.create_user(email="c@test.com", password="pw"))
        self.assertEqual(customer.get("/api/admin/organizers/pending/").status_code, 403)
        self.assertEqual(customer.post("/api/admin/organizers/create/", {}).status_code, 403)
        self.assertEqual(customer.get("/api/organizer/events/").status_code, 403)
        self.assertEqual(customer.post("/api/tickets/check-in/", {"ticket_number": "x"}).status_code, 403)

    # 9
    def test_admin_created_organizer_can_log_in_at_once(self):
        res = self.admin_client.post("/api/admin/organizers/create/", {
            "email": "direct@test.com", "username": "direct", "password": "Temp1234",
            "organization_name": "Direct Events",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["organizer_status"], "APPROVED")
        self.assertEqual(login("direct@test.com", "Temp1234").status_code, 200)

    def test_invalid_status_change_is_refused(self):
        self.register()
        # Can't suspend someone who was never approved.
        res = self.admin_client.patch(f"/api/admin/organizers/{self.organizer().id}/suspend/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("error", res.data)

    def test_register_is_throttled(self):
        codes = [
            self.register(email=f"spam{i}@test.com", username=f"spam{i}").status_code
            for i in range(11)
        ]
        self.assertEqual(codes[-1], 429)
