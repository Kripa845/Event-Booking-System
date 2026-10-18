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
