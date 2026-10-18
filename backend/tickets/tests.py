import datetime
import tempfile

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from bookings.models import Booking
from events.models import Event
from users.models import User

from .models import Ticket
from .sky import CONSTELLATION_MIN


def make_event(organizer, category=Event.Category.HACKATHON, days=-3, title="Event"):
    return Event.objects.create(
        organizer=organizer,
        title=title,
        description="desc",
        category=category,
        location="Kathmandu",
        date=datetime.date.today() + datetime.timedelta(days=days),
        start_time=datetime.time(10),
        end_time=datetime.time(12),
        capacity=50,
        status=Event.Status.PUBLISHED,
    )


def attend(user, event):
    booking = Booking.objects.create(user=user, event=event)
    booking.ticket.status = Ticket.Status.USED
    booking.ticket.save()
    return booking


# Tickets generate QR images on save; keep them out of the real media folder.
@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class NightSkyTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.user = User.objects.create_user(email="me@test.com", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def get_sky(self):
        res = self.client.get("/api/tickets/sky/")
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_empty_sky(self):
        sky = self.get_sky()
        self.assertEqual(sky["stars"], [])
        self.assertEqual(sky["stats"]["stars"], 0)

    def test_only_scanned_tickets_become_stars(self):
        attend(self.user, make_event(self.organizer, title="Went"))
        Booking.objects.create(user=self.user, event=make_event(self.organizer, title="Skipped"))
        cancelled = attend(self.user, make_event(self.organizer, title="Cancelled"))
        cancelled.status = Booking.Status.CANCELLED
        cancelled.save()

        titles = [s["title"] for s in self.get_sky()["stars"]]
        self.assertEqual(titles, ["Went"])

    def test_constellation_forms_at_threshold(self):
        for i in range(CONSTELLATION_MIN):
            attend(self.user, make_event(self.organizer, days=-(i + 1)))
        attend(self.user, make_event(self.organizer, category=Event.Category.CONCERT))

        sky = self.get_sky()
        by_cat = {c["category"]: c for c in sky["constellations"]}

        self.assertTrue(by_cat["HACKATHON"]["formed"])
        self.assertEqual(by_cat["HACKATHON"]["name"], "The Hacker")
        self.assertFalse(by_cat["CONCERT"]["formed"])
        self.assertEqual(by_cat["CONCERT"]["needed"], CONSTELLATION_MIN - 1)
        self.assertEqual(sky["stats"]["constellations_formed"], 1)
        # Stars come back oldest first, so the frontend can join them in order.
        dates = [s["date"] for s in sky["stars"]]
        self.assertEqual(dates, sorted(dates))

    def test_sky_is_private(self):
        other = User.objects.create_user(email="other@test.com", password="pw")
        attend(other, make_event(self.organizer))
        self.assertEqual(self.get_sky()["stars"], [])


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class CheckInTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.other_org = User.objects.create_user(
            email="org2@test.com", password="pw", role="ORGANIZER"
        )
        self.guest = User.objects.create_user(email="guest@test.com", password="pw")
        self.event = make_event(self.organizer, days=0)
        self.booking = Booking.objects.create(user=self.guest, event=self.event)
        self.ticket = self.booking.ticket
        self.client = APIClient()
        self.client.force_authenticate(self.organizer)

    def test_live_check_in(self):
        res = self.client.post("/api/tickets/check-in/", {"ticket_number": self.ticket.ticket_number})
        self.assertEqual(res.status_code, 200)
        res = self.client.post("/api/tickets/check-in/", {"ticket_number": self.ticket.ticket_number})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data["code"], "already_used")

    def test_cannot_check_in_another_organizers_event(self):
        client = APIClient()
        client.force_authenticate(self.other_org)
        res = client.post("/api/tickets/check-in/", {"ticket_number": self.ticket.ticket_number})
        self.assertEqual(res.status_code, 403)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, Ticket.Status.VALID)

    def test_manifest_lists_event_tickets(self):
        res = self.client.get(f"/api/organizer/events/{self.event.id}/checkin-manifest/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            [t["ticket_number"] for t in res.data["tickets"]], [self.ticket.ticket_number]
        )

        client = APIClient()
        client.force_authenticate(self.other_org)
        res = client.get(f"/api/organizer/events/{self.event.id}/checkin-manifest/")
        self.assertEqual(res.status_code, 403)

    def sync(self, scans, event_id=None):
        res = self.client.post(
            "/api/tickets/check-in/sync/",
            {"event_id": event_id or self.event.id, "scans": scans},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        return {r["ticket_number"]: r["result"] for r in res.data["results"]}

    def test_sync_applies_offline_scans_with_their_scan_time(self):
        scanned_at = "2026-01-01T10:15:00+00:00"
        results = self.sync([
            {"ticket_number": self.ticket.ticket_number, "scanned_at": scanned_at},
            {"ticket_number": "EVT-NOPE", "scanned_at": scanned_at},
        ])
        self.assertEqual(results[self.ticket.ticket_number], "checked_in")
        self.assertEqual(results["EVT-NOPE"], "invalid")

        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, Ticket.Status.USED)
        self.assertEqual(self.ticket.checked_in_at.isoformat(), scanned_at)

    def test_resending_the_same_scan_is_not_a_duplicate(self):
        scan = {"ticket_number": self.ticket.ticket_number, "scanned_at": "2026-01-01T10:15:00+00:00"}
        self.sync([scan])
        # e.g. the connection dropped before the first response arrived
        self.assertEqual(self.sync([scan])[self.ticket.ticket_number], "checked_in")

    def test_sync_flags_tickets_used_on_another_device(self):
        self.sync([{"ticket_number": self.ticket.ticket_number, "scanned_at": "2026-01-01T10:15:00+00:00"}])
        later = {"ticket_number": self.ticket.ticket_number, "scanned_at": "2026-01-01T10:40:00+00:00"}
        self.assertEqual(self.sync([later])[self.ticket.ticket_number], "already_used")

    def test_sync_rejects_tickets_for_other_events(self):
        other_event = make_event(self.organizer, days=0, title="Other")
        self.assertEqual(
            self.sync([{"ticket_number": self.ticket.ticket_number}], event_id=other_event.id)
            [self.ticket.ticket_number],
            "wrong_event",
        )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class TransferTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.alice = User.objects.create_user(email="alice@test.com", password="pw")
        self.bob = User.objects.create_user(email="bob@test.com", password="pw")
        self.event = make_event(self.organizer, days=5)
        self.booking = Booking.objects.create(user=self.alice, event=self.event, price_paid=375)
        self.client = APIClient()
        self.client.force_authenticate(self.alice)

    def transfer(self, email, ticket=None):
        ticket = ticket or self.booking.ticket
        return self.client.post(f"/api/tickets/{ticket.id}/transfer/", {"email": email})

    def test_transfer_reissues_ticket_at_original_price(self):
        old_number = self.booking.ticket.ticket_number
        res = self.transfer("BOB@test.com")
        self.assertEqual(res.status_code, 200, res.data)

        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CANCELLED)
        self.assertEqual(self.booking.ticket.status, Ticket.Status.CANCELLED)

        new = Booking.objects.get(user=self.bob, event=self.event)
        self.assertEqual(new.status, Booking.Status.CONFIRMED)
        self.assertEqual(new.transferred_from, self.booking)
        self.assertEqual(new.price_paid, 375)
        self.assertNotEqual(new.ticket.ticket_number, old_number)

        # The old QR is dead at the door.
        self.client.force_authenticate(self.organizer)
        res = self.client.post("/api/tickets/check-in/", {"ticket_number": old_number})
        self.assertEqual(res.data["code"], "cancelled")

    def test_both_sides_see_the_transfer(self):
        self.transfer("bob@test.com")
        mine = self.client.get("/api/tickets/").data
        mine = mine.get("results", mine)
        self.assertEqual(mine[0]["transferred_to"], "bob")

        self.client.force_authenticate(self.bob)
        theirs = self.client.get("/api/tickets/").data
        theirs = theirs.get("results", theirs)
        self.assertEqual(theirs[0]["transferred_from"], "alice")

    def test_rejections(self):
        self.assertEqual(self.transfer("nobody@test.com").status_code, 400)
        self.assertEqual(self.transfer("alice@test.com").status_code, 400)

        Booking.objects.create(user=self.bob, event=self.event)
        self.assertIn("already has a ticket", self.transfer("bob@test.com").data["error"])

    def test_cannot_transfer_someone_elses_ticket(self):
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.transfer("bob@test.com").status_code, 400)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.Status.CONFIRMED)

    def test_cannot_transfer_used_or_past(self):
        self.booking.ticket.status = Ticket.Status.USED
        self.booking.ticket.save()
        self.assertEqual(self.transfer("bob@test.com").status_code, 400)
