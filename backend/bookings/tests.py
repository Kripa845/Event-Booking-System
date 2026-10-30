import datetime
import tempfile

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from events.models import Event
from tickets.models import Ticket
from users.models import User
from waitlist.models import WaitlistEntry

from .models import Booking


def make_event(organizer, capacity=1):
    return Event.objects.create(
        organizer=organizer,
        title="Test Event",
        description="desc",
        location="Kathmandu",
        date=datetime.date.today() + datetime.timedelta(days=7),
        start_time=datetime.time(10),
        end_time=datetime.time(12),
        capacity=capacity,
        status=Event.Status.PUBLISHED,
    )


# Tickets generate QR images on save; keep them out of the real media folder.
@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class RebookAndWaitlistTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.alice = User.objects.create_user(email="alice@test.com", password="pw")
        self.bob = User.objects.create_user(email="bob@test.com", password="pw")
        self.event = make_event(self.organizer, capacity=1)

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_user_can_rebook_after_cancelling(self):
        client = self.client_for(self.alice)

        first = client.post("/api/bookings/", {"event": self.event.id})
        self.assertEqual(first.status_code, 201)
        client.post(f"/api/bookings/{first.data['id']}/cancel/")

        second = client.post("/api/bookings/", {"event": self.event.id})
        self.assertEqual(second.status_code, 201)

        # Fresh booking gets a fresh, valid ticket.
        ticket = Ticket.objects.get(booking_id=second.data["id"])
        self.assertEqual(ticket.status, Ticket.Status.VALID)

    def test_promoting_user_who_previously_cancelled(self):
        alice = self.client_for(self.alice)
        bob = self.client_for(self.bob)

        # Bob books, cancels, Alice takes the seat, Bob joins the waitlist.
        b = bob.post("/api/bookings/", {"event": self.event.id})
        bob.post(f"/api/bookings/{b.data['id']}/cancel/")
        a = alice.post("/api/bookings/", {"event": self.event.id})
        self.assertEqual(
            bob.post("/api/waitlist/", {"event": self.event.id}).status_code, 201
        )

        # Alice cancelling must succeed and promote Bob.
        res = alice.post(f"/api/bookings/{a.data['id']}/cancel/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            Booking.objects.filter(
                user=self.bob, event=self.event, status=Booking.Status.CONFIRMED
            ).exists()
        )

    def test_promotion_skips_users_who_already_hold_a_seat(self):
        carol = User.objects.create_user(email="carol@test.com", password="pw")
        self.event.capacity = 2
        self.event.save()

        alice_booking = Booking.objects.create(user=self.alice, event=self.event)
        Booking.objects.create(user=self.bob, event=self.event)
        WaitlistEntry.objects.create(user=self.bob, event=self.event, position=1)
        WaitlistEntry.objects.create(user=carol, event=self.event, position=2)

        res = self.client_for(self.alice).post(
            f"/api/bookings/{alice_booking.id}/cancel/"
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            Booking.objects.filter(
                user=carol, event=self.event, status=Booking.Status.CONFIRMED
            ).exists()
        )

    def test_can_rejoin_waitlist_after_promotion(self):
        WaitlistEntry.objects.create(
            user=self.bob, event=self.event, position=1,
            status=WaitlistEntry.Status.PROMOTED,
        )
        Booking.objects.create(user=self.alice, event=self.event)

        res = self.client_for(self.bob).post("/api/waitlist/", {"event": self.event.id})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], WaitlistEntry.Status.WAITING)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class BookingLockdownTests(TestCase):
    """Bookings can only be created, read and cancelled through their own rules."""

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.alice = User.objects.create_user(email="alice@test.com", password="pw")
        self.bob = User.objects.create_user(email="bob@test.com", password="pw")
        self.event = make_event(self.organizer, capacity=1)
        self.other_event = make_event(self.organizer, capacity=5)
        self.client = APIClient()
        self.client.force_authenticate(self.alice)
        res = self.client.post("/api/bookings/", {"event": self.event.id})
        self.assertEqual(res.status_code, 201)
        self.booking = Booking.objects.get(id=res.data["id"])

    def test_booking_creates_a_ticket(self):
        self.assertEqual(self.booking.ticket.status, Ticket.Status.VALID)

    def test_cancel_promotes_the_waitlist(self):
        bob = APIClient()
        bob.force_authenticate(self.bob)
        self.assertEqual(bob.post("/api/waitlist/", {"event": self.event.id}).status_code, 201)

        res = self.client.post(f"/api/bookings/{self.booking.id}/cancel/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(Booking.objects.filter(
            user=self.bob, event=self.event, status=Booking.Status.CONFIRMED,
        ).exists())

    def test_patch_cannot_move_booking_to_another_event(self):
        res = self.client.patch(
            f"/api/bookings/{self.booking.id}/", {"event": self.other_event.id}, format="json",
        )
        self.assertEqual(res.status_code, 405)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.event, self.event)

    def test_put_is_not_allowed(self):
        res = self.client.put(
            f"/api/bookings/{self.booking.id}/", {"event": self.other_event.id}, format="json",
        )
        self.assertEqual(res.status_code, 405)

    def test_delete_is_not_allowed(self):
        res = self.client.delete(f"/api/bookings/{self.booking.id}/")
        self.assertEqual(res.status_code, 405)
        self.assertTrue(Booking.objects.filter(id=self.booking.id).exists())
        self.assertTrue(Ticket.objects.filter(booking_id=self.booking.id).exists())

    def test_users_cannot_see_or_cancel_each_others_bookings(self):
        bob = APIClient()
        bob.force_authenticate(self.bob)
        self.assertEqual(bob.get(f"/api/bookings/{self.booking.id}/").status_code, 404)
        self.assertEqual(bob.post(f"/api/bookings/{self.booking.id}/cancel/").status_code, 404)
        listed = bob.get("/api/bookings/").data
        self.assertEqual(listed.get("results", listed), [])
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)

    def test_organizers_cannot_book(self):
        org = APIClient()
        org.force_authenticate(self.organizer)
        res = org.post("/api/bookings/", {"event": self.other_event.id})
        self.assertEqual(res.status_code, 403)
        self.assertIn("error", res.data)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class PromoFriendsAndStaffTests(TestCase):

    def setUp(self):
        self.org = User.objects.create_user(email="org@test.com", password="pw", role="ORGANIZER")
        self.other_org = User.objects.create_user(email="org2@test.com", password="pw", role="ORGANIZER")
        self.alice = User.objects.create_user(email="alice@test.com", password="pw")
        self.bob = User.objects.create_user(email="bob@test.com", password="pw")
        self.cara = User.objects.create_user(email="cara@test.com", password="pw")
        self.event = make_event(self.org, capacity=3)
        self.event.price = 1000
        self.event.save()

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    # ── Promo codes ──
    def make_promo(self, **data):
        return self.client_for(self.org).post(
            f"/api/organizer/events/{self.event.id}/promos/", {"code": "student20", "percent_off": 20, **data},
        )

    def test_promo_discounts_price_and_counts_uses(self):
        self.assertEqual(self.make_promo(max_uses=1).data["code"], "STUDENT20")
        alice = self.client_for(self.alice)
        self.assertEqual(alice.post(f"/api/events/{self.event.id}/promo-check/", {"code": "Student20"}).data["price"], 800)

        res = alice.post("/api/bookings/", {"event": self.event.id, "promo_code": "student20"})
        self.assertEqual(res.status_code, 201)
        booking = Booking.objects.get(id=res.data["id"])
        self.assertEqual(booking.price_paid, 800)
        self.assertEqual(booking.promo_code, "STUDENT20")

        res = self.client_for(self.bob).post("/api/bookings/", {"event": self.event.id, "promo_code": "STUDENT20"})
        self.assertEqual(res.data["error"], "That promo code has been used up.")

    def test_invalid_or_inactive_promo_is_refused(self):
        promo_id = self.make_promo().data["id"]
        self.client_for(self.org).patch(f"/api/organizer/promos/{promo_id}/", {"active": False}, format="json")
        res = self.client_for(self.alice).post("/api/bookings/", {"event": self.event.id, "promo_code": "STUDENT20"})
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Booking.objects.filter(user=self.alice).exists())

    def test_only_the_owner_manages_promos(self):
        url = f"/api/organizer/events/{self.event.id}/promos/"
        self.assertEqual(self.client_for(self.other_org).post(url, {"code": "X1", "percent_off": 10}).status_code, 403)
        self.assertEqual(self.client_for(self.alice).get(url).status_code, 403)
        self.assertEqual(self.make_promo(percent_off=0).status_code, 400)

    # ── Booking for friends ──
    def test_book_for_friends(self):
        self.event.price = 0   # free, so tickets are issued at once (paid orders: payments/tests.py)
        self.event.save()
        res = self.client_for(self.alice).post(
            "/api/bookings/", {"event": self.event.id, "friends": ["BOB@test.com", "cara@test.com"]}, format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(sorted(res.data["friends"]), ["bob", "cara"])
        self.assertEqual(Booking.objects.filter(event=self.event, status=Booking.Status.CONFIRMED).count(), 3)
        self.assertTrue(Ticket.objects.filter(booking__user=self.bob).exists())
        self.event.refresh_from_db()
        self.assertEqual(self.event.status, Event.Status.SOLD_OUT)

    def test_friends_booking_is_all_or_nothing(self):
        Booking.objects.create(user=self.cara, event=self.event)
        res = self.client_for(self.alice).post(
            "/api/bookings/", {"event": self.event.id, "friends": ["bob@test.com", "cara@test.com"]}, format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("cara", res.data["error"])
        self.assertFalse(Booking.objects.filter(user__in=[self.alice, self.bob]).exists())

    def test_friends_must_fit_and_exist(self):
        small = make_event(self.org, capacity=1)
        res = self.client_for(self.alice).post("/api/bookings/", {"event": small.id, "friends": ["bob@test.com"]}, format="json")
        self.assertEqual(res.data["error"], "Only 1 seat left.")
        res = self.client_for(self.alice).post("/api/bookings/", {"event": self.event.id, "friends": ["ghost@test.com"]}, format="json")
        self.assertIn("No EventHub account", res.data["error"])

    # ── Door staff ──
    def test_door_staff_can_scan_only_their_event(self):
        ticket = Booking.objects.create(user=self.alice, event=self.event).ticket
        other_event = make_event(self.org, capacity=5)
        other_ticket = Booking.objects.create(user=self.cara, event=other_event).ticket
        staff = self.client_for(self.bob)

        self.assertEqual(staff.post("/api/tickets/check-in/", {"ticket_number": ticket.ticket_number}).status_code, 403)
        res = self.client_for(self.org).post(f"/api/organizer/events/{self.event.id}/staff/", {"email": "bob@test.com"})
        self.assertEqual(res.status_code, 201)

        self.assertEqual([e["id"] for e in staff.get("/api/checkin/events/").data], [self.event.id])
        self.assertTrue(staff.get("/api/auth/profile/").data["is_door_staff"])
        self.assertEqual(staff.get(f"/api/organizer/events/{self.event.id}/checkin-manifest/").status_code, 200)
        res = staff.post("/api/tickets/check-in/", {"ticket_number": ticket.ticket_number, "event_id": self.event.id})
        self.assertEqual(res.status_code, 200)
        res = staff.post("/api/tickets/check-in/", {"ticket_number": other_ticket.ticket_number})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(staff.get(f"/api/organizer/events/{self.event.id}/attendees/").status_code, 403)

        self.client_for(self.org).delete(f"/api/organizer/events/{self.event.id}/staff/{self.bob.id}/")
        self.assertEqual(staff.get("/api/checkin/events/").status_code, 403)

    def test_staff_must_be_a_customer_and_owner_only(self):
        url = f"/api/organizer/events/{self.event.id}/staff/"
        self.assertEqual(self.client_for(self.org).post(url, {"email": "org2@test.com"}).status_code, 400)
        self.assertEqual(self.client_for(self.other_org).post(url, {"email": "bob@test.com"}).status_code, 403)
