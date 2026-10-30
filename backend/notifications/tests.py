from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from .services import notify


class NotificationTests(TestCase):

    def setUp(self):
        self.me = User.objects.create_user(email="me@test.com", password="pw")
        self.other = User.objects.create_user(email="other@test.com", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(self.me)

    def test_only_my_notifications_are_listed(self):
        notify(self.me, "Hi", "For me")
        notify(self.other, "Hi", "Not for me")

        res = self.client.get("/api/notifications/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["unread"], 1)
        self.assertEqual([n["message"] for n in res.data["results"]], ["For me"])

    def test_mark_all_read(self):
        notify(self.me, "Hi", "One")
        notify(self.other, "Hi", "Theirs")

        self.client.post("/api/notifications/read/")
        res = self.client.get("/api/notifications/")
        self.assertEqual(res.data["unread"], 0)
        self.assertTrue(res.data["results"][0]["read"])

        # Someone else's stay unread.
        other = APIClient()
        other.force_authenticate(self.other)
        self.assertEqual(other.get("/api/notifications/").data["unread"], 1)

    def test_login_required(self):
        self.assertEqual(APIClient().get("/api/notifications/").status_code, 401)


import datetime
import tempfile
from unittest import mock

from django.core import mail
from django.test import override_settings

from bookings.models import Booking
from events.models import Event
from feedback.models import EventFeedback
from tickets.models import Ticket

from .models import Notification


def upcoming_event(organizer, status=Event.Status.PUBLISHED, days=5):
    return Event.objects.create(
        organizer=organizer, title="Jazz Night", description="d", location="Lalitpur",
        date=datetime.date.today() + datetime.timedelta(days=days),
        start_time=datetime.time(18), end_time=datetime.time(21), capacity=10, status=status,
    )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class Phase4aTests(TestCase):

    def setUp(self):
        self.org = User.objects.create_user(email="org@test.com", password="pw", role="ORGANIZER")
        self.fan = User.objects.create_user(email="fan@test.com", password="pw")
        self.fan_client = APIClient()
        self.fan_client.force_authenticate(self.fan)
        self.org_client = APIClient()
        self.org_client.force_authenticate(self.org)

    def test_follow_unfollow_and_hear_about_published_events_once(self):
        url = f"/api/organizers/{self.org.id}/follow/"
        self.assertEqual(self.fan_client.post(url).data, {"following": True, "followers": 1})

        draft = upcoming_event(self.org, status=Event.Status.DRAFT)
        self.assertFalse(Notification.objects.filter(user=self.fan).exists())
        self.org_client.patch(f"/api/events/{draft.id}/", {"status": "PUBLISHED"}, format="json")
        self.org_client.patch(f"/api/events/{draft.id}/", {"status": "DRAFT"}, format="json")
        self.org_client.patch(f"/api/events/{draft.id}/", {"status": "PUBLISHED"}, format="json")
        self.assertEqual(Notification.objects.filter(user=self.fan).count(), 1)

        self.assertEqual(self.fan_client.delete(url).data["following"], False)

    def test_cannot_follow_a_customer_or_yourself(self):
        other = User.objects.create_user(email="c@test.com", password="pw")
        self.assertEqual(self.fan_client.post(f"/api/organizers/{other.id}/follow/").status_code, 404)
        self.assertEqual(self.org_client.post(f"/api/organizers/{self.org.id}/follow/").status_code, 400)

    def test_booking_emails_the_ticket_with_qr(self):
        event = upcoming_event(self.org)
        with self.captureOnCommitCallbacks(execute=True):
            self.fan_client.post("/api/bookings/", {"event": event.id})
        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertEqual(email.to, [self.fan.email])
        self.assertIn(Ticket.objects.get(booking__user=self.fan).ticket_number, email.body)
        self.assertEqual(email.attachments[0][2], "image/png")

    def test_reviews_with_comments_are_public(self):
        event = upcoming_event(self.org, days=-1)
        booking = Booking.objects.create(user=self.fan, event=event)
        booking.ticket.status = Ticket.Status.USED
        booking.ticket.save()

        res = self.fan_client.post(f"/api/postcards/{event.id}/rate/", {"rating": 5, "comment": "Loved it!"})
        self.assertEqual(res.status_code, 200)
        EventFeedback.objects.create(
            user=User.objects.create_user(email="q@test.com", password="pw"), event=event, rating=3,
        )

        res = APIClient().get(f"/api/events/{event.id}/reviews/")
        self.assertEqual(res.data["avg_rating"], 4.0)
        self.assertEqual(res.data["ratings"], 2)
        self.assertEqual([r["comment"] for r in res.data["reviews"]], ["Loved it!"])

    def test_map_location(self):
        event = upcoming_event(self.org)
        with mock.patch("events.views.geocode", return_value=(27.67, 85.32, "Lalitpur")):
            res = APIClient().get(f"/api/events/{event.id}/map/")
        self.assertEqual(res.data, {"available": True, "lat": 27.67, "lon": 85.32, "place": "Lalitpur"})
        with mock.patch("events.views.geocode", side_effect=OSError("offline")):
            self.assertEqual(APIClient().get(f"/api/events/{event.id}/map/").data, {"available": False})
