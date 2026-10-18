from django.test import TestCase

# Create your tests here.


import datetime
import tempfile

from django.test import override_settings
from rest_framework.test import APIClient

from bookings.models import Booking
from events.models import Event
from users.models import User

from .models import WaitlistEntry


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class PlaceInLineTests(TestCase):

    def test_place_counts_only_people_still_waiting(self):
        org = User.objects.create_user(email="o@test.com", password="pw", role="ORGANIZER")
        event = Event.objects.create(
            organizer=org, title="E", description="d", location="K",
            date=datetime.date.today() + datetime.timedelta(days=3),
            start_time=datetime.time(10), end_time=datetime.time(12), capacity=1,
            status=Event.Status.PUBLISHED,
        )
        users = [User.objects.create_user(email=f"u{i}@test.com", password="pw") for i in range(3)]
        Booking.objects.create(user=users[0], event=event)
        promoted = User.objects.create_user(email="p@test.com", password="pw")
        WaitlistEntry.objects.create(user=promoted, event=event, position=1, status=WaitlistEntry.Status.PROMOTED)
        WaitlistEntry.objects.create(user=users[1], event=event, position=2)
        WaitlistEntry.objects.create(user=users[2], event=event, position=3)

        client = APIClient()
        client.force_authenticate(users[2])
        data = client.get("/api/waitlist/").data
        data = data.get("results", data)
        self.assertEqual(data[0]["place_in_line"], 2)
