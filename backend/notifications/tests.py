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
