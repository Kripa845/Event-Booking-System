import datetime
import tempfile

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from bookings.models import Booking
from events.models import Event
from recommendations.services import get_recommendations
from tickets.models import Ticket
from users.models import User

from .models import EventFeedback


def make_event(organizer, title, days, category=Event.Category.WORKSHOP, tags=""):
    return Event.objects.create(
        organizer=organizer, title=title, description=title, category=category, tags=tags,
        location="Kathmandu", date=datetime.date.today() + datetime.timedelta(days=days),
        start_time=datetime.time(10), end_time=datetime.time(12),
        capacity=50, status=Event.Status.PUBLISHED,
    )


def attend(user, event):
    booking = Booking.objects.create(user=user, event=event)
    booking.ticket.status = Ticket.Status.USED
    booking.ticket.save()
    return booking


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class PostcardTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.user = User.objects.create_user(email="me@test.com", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.went = make_event(self.organizer, "Went", -2)
        attend(self.user, self.went)

    def test_postcards_only_for_attended_events(self):
        Booking.objects.create(user=self.user, event=make_event(self.organizer, "Booked only", -1))
        cards = self.client.get("/api/postcards/").data["postcards"]
        self.assertEqual([c["title"] for c in cards], ["Went"])
        self.assertIsNone(cards[0]["rating"])

    def test_rate_and_rerate(self):
        url = f"/api/postcards/{self.went.id}/rate/"
        self.assertEqual(self.client.post(url, {"rating": 4}).status_code, 200)
        self.assertEqual(self.client.post(url, {"rating": 5}).status_code, 200)
        self.assertEqual(EventFeedback.objects.get(user=self.user, event=self.went).rating, 5)
        self.assertEqual(self.client.get("/api/postcards/").data["postcards"][0]["rating"], 5)

    def test_cannot_rate_events_not_attended(self):
        other = make_event(self.organizer, "Never went", -1)
        self.assertEqual(self.client.post(f"/api/postcards/{other.id}/rate/", {"rating": 5}).status_code, 403)
        self.assertEqual(self.client.post(f"/api/postcards/{self.went.id}/rate/", {"rating": 9}).status_code, 400)

    def test_organizer_sees_average_rating(self):
        EventFeedback.objects.create(user=self.user, event=self.went, rating=4)
        fan = User.objects.create_user(email="fan@test.com", password="pw")
        attend(fan, self.went)
        EventFeedback.objects.create(user=fan, event=self.went, rating=5)

        client = APIClient()
        client.force_authenticate(self.organizer)
        stats = client.get(f"/api/organizer/events/{self.went.id}/stats/").data
        self.assertEqual(stats["avg_rating"], 4.5)
        self.assertEqual(stats["ratings"], 2)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class RatingAwareRecommendationTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.user = User.objects.create_user(email="me@test.com", password="pw")
        self.jazz_past = make_event(self.organizer, "Jazz night live music", -3, Event.Category.CONCERT, "jazz,music")
        self.python_past = make_event(self.organizer, "Python django coding", -4, Event.Category.WORKSHOP, "python,django")
        attend(self.user, self.jazz_past)
        attend(self.user, self.python_past)
        self.jazz_next = make_event(self.organizer, "Jazz music evening", 5, Event.Category.CONCERT, "jazz,music")
        self.python_next = make_event(self.organizer, "Advanced python django", 6, Event.Category.WORKSHOP, "python,django")

    def top(self):
        return get_recommendations(self.user, limit=1)[0][0]

    def test_disliked_event_stops_shaping_suggestions(self):
        EventFeedback.objects.create(user=self.user, event=self.jazz_past, rating=1)
        self.assertEqual(self.top(), self.python_next)

        EventFeedback.objects.filter(user=self.user, event=self.jazz_past).update(rating=5)
        EventFeedback.objects.create(user=self.user, event=self.python_past, rating=1)
        self.assertEqual(self.top(), self.jazz_next)
