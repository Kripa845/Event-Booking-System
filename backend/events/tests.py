import datetime
import json
import tempfile

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from bookings.models import Booking
from tickets.models import Ticket
from users.models import User

from .models import Event
from .turnout import DEFAULT_SHOW_RATE, OVERBOOK_Z, predict_turnout, safe_overbook


def make_event(organizer, days_from_now, category=Event.Category.WORKSHOP, capacity=50):
    return Event.objects.create(
        organizer=organizer,
        title="Event",
        description="desc",
        category=category,
        location="Kathmandu",
        date=datetime.date.today() + datetime.timedelta(days=days_from_now),
        start_time=datetime.time(10),
        end_time=datetime.time(12),
        capacity=capacity,
        status=Event.Status.PUBLISHED,
    )


def attend(booking):
    booking.ticket.status = Ticket.Status.USED
    booking.ticket.save()


# Tickets generate QR images on save; keep them out of the real media folder.
@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class TurnoutPredictionTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.reliable = User.objects.create_user(email="r@test.com", password="pw")
        self.flaky = User.objects.create_user(email="f@test.com", password="pw")
        self.newbie = User.objects.create_user(email="n@test.com", password="pw")

        for i in range(5):
            past = make_event(self.organizer, days_from_now=-(i + 1))
            attend(Booking.objects.create(user=self.reliable, event=past))
            Booking.objects.create(user=self.flaky, event=past)  # never shows

        self.upcoming = make_event(self.organizer, days_from_now=3)
        for user in (self.reliable, self.flaky, self.newbie):
            Booking.objects.create(user=user, event=self.upcoming)

    def test_history_drives_individual_probabilities(self):
        result = predict_turnout(self.upcoming)
        probs = {a["username"]: a["show_probability"] for a in result["attendees"]}

        self.assertGreater(probs["r"], probs["n"])
        self.assertGreater(probs["n"], probs["f"])
        self.assertEqual(result["attendees"][0]["username"], "f")  # riskiest first
        self.assertEqual(result["attendees"][0]["risk"], "HIGH")
        self.assertEqual(result["confirmed"], 3)

    def test_no_history_falls_back_to_default(self):
        fresh = make_event(self.organizer, days_from_now=3, category=Event.Category.CONCERT)
        Booking.objects.exclude(event=fresh).delete()
        Booking.objects.create(user=self.newbie, event=fresh)

        result = predict_turnout(fresh)
        self.assertAlmostEqual(result["expected_show_rate"], DEFAULT_SHOW_RATE, places=3)
        self.assertFalse(result["enough_history"])
        self.assertEqual(result["suggested_overbook"], 0)

    def test_cancelled_bookings_are_ignored(self):
        Booking.objects.filter(user=self.newbie, event=self.upcoming).update(
            status=Booking.Status.CANCELLED
        )
        self.assertEqual(predict_turnout(self.upcoming)["confirmed"], 2)

    def test_safe_overbook(self):
        self.assertEqual(safe_overbook(100, 1.0), 0)
        self.assertEqual(safe_overbook(100, 0.99), 0)
        extra = safe_overbook(100, 0.7)
        self.assertGreater(extra, 0)
        # Selling capacity + extra must keep the 95% upper bound within capacity.
        n = 100 + extra
        self.assertLessEqual(n * 0.7 + OVERBOOK_Z * (n * 0.7 * 0.3) ** 0.5, 100)

    def test_endpoint_requires_ownership(self):
        client = APIClient()
        client.force_authenticate(self.newbie)
        url = f"/api/organizer/events/{self.upcoming.id}/turnout/"
        self.assertEqual(client.get(url).status_code, 403)

        client.force_authenticate(self.organizer)
        res = client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["attendees"]), 3)


class DateCheckTests(TestCase):

    def setUp(self):
        from .models import Holiday
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        Holiday.objects.create(
            name="Test Festival", start_date=datetime.date(2030, 10, 17),
            end_date=datetime.date(2030, 10, 23), major=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.organizer)

    def check(self, **params):
        res = self.client.get("/api/events/date-check/", params)
        self.assertEqual(res.status_code, 200)
        return res.data

    def make(self, **kw):
        defaults = dict(
            organizer=self.organizer, title="Existing", description="d",
            category=Event.Category.CONCERT, location="Patan", date=datetime.date(2030, 11, 1),
            start_time=datetime.time(10), end_time=datetime.time(12),
            capacity=10, status=Event.Status.PUBLISHED,
        )
        defaults.update(kw)
        return Event.objects.create(**defaults)

    def test_flags_multi_day_holiday(self):
        data = self.check(date="2030-10-20")
        self.assertEqual([h["name"] for h in data["holidays"]], ["Test Festival"])
        self.assertTrue(data["holidays"][0]["major"])
        self.assertEqual(self.check(date="2030-10-24")["holidays"], [])

    def test_flags_same_place_or_same_kind(self):
        existing = self.make()
        self.make(title="Draft", status=Event.Status.DRAFT)       # drafts don't count
        self.make(title="Elsewhere", location="Pokhara", category=Event.Category.SPORTS)

        data = self.check(date="2030-11-01", location="patan", category="WORKSHOP")
        self.assertEqual([c["title"] for c in data["clashes"]], ["Existing"])
        self.assertEqual(data["clashes"][0]["reasons"], ["same place"])

        # Editing an event shouldn't warn about itself.
        data = self.check(date="2030-11-01", location="Patan", exclude=existing.id)
        self.assertEqual(data["clashes"], [])

    def test_customers_cannot_use_it(self):
        client = APIClient()
        client.force_authenticate(User.objects.create_user(email="c@test.com", password="pw"))
        self.assertEqual(client.get("/api/events/date-check/", {"date": "2030-10-20"}).status_code, 403)

    def test_event_lists_its_holidays(self):
        event = self.make(date=datetime.date(2030, 10, 21))
        res = APIClient().get(f"/api/events/{event.id}/")
        self.assertEqual(res.data["holidays"], ["Test Festival"])


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class EarlyBirdPricingTests(TestCase):

    def setUp(self):
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        self.event = make_event(self.organizer, days_from_now=10, capacity=5)
        self.event.price = 500
        self.event.early_bird_discount = 25
        self.event.early_bird_seats = 2
        self.event.save()

    def book(self, n):
        u = User.objects.create_user(email=f"u{n}@test.com", password="pw")
        client = APIClient()
        client.force_authenticate(u)
        res = client.post("/api/bookings/", {"event": self.event.id})
        self.assertEqual(res.status_code, 201)
        return Booking.objects.get(id=res.data["id"])

    def test_price_steps_up_after_early_bird_seats(self):
        pricing = APIClient().get(f"/api/events/{self.event.id}/").data["pricing"]
        self.assertEqual(pricing["tier"], "EARLY_BIRD")
        self.assertEqual(pricing["price"], 375)
        self.assertEqual(pricing["left_at_price"], 2)

        paid = [self.book(i).price_paid for i in range(3)]
        self.assertEqual(paid, [375, 375, 500])

        pricing = APIClient().get(f"/api/events/{self.event.id}/").data["pricing"]
        self.assertEqual(pricing["tier"], "REGULAR")

    def test_revenue_uses_price_paid(self):
        for i in range(3):
            self.book(i)
        client = APIClient()
        client.force_authenticate(self.organizer)
        stats = client.get(f"/api/organizer/events/{self.event.id}/stats/").data
        self.assertEqual(stats["revenue"], 375 + 375 + 500)

    def test_validation(self):
        client = APIClient()
        client.force_authenticate(self.organizer)
        url = f"/api/events/{self.event.id}/"
        self.assertEqual(client.patch(url, {"early_bird_seats": 99}).status_code, 400)
        self.assertEqual(client.patch(url, {"early_bird_discount": 95}).status_code, 400)
        self.assertEqual(client.patch(url, {"early_bird_discount": 10, "early_bird_seats": 3}).status_code, 200)

    def test_free_events_have_no_early_bird(self):
        self.event.price = 0
        self.event.save()
        self.assertEqual(APIClient().get(f"/api/events/{self.event.id}/").data["pricing"]["tier"], "REGULAR")


class WeatherTests(TestCase):

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )

    def fake_fetch(self, rain=80, code=61):
        def fetch(url, params):
            if "geocoding" in url:
                return {"results": [{"latitude": 27.7, "longitude": 85.3, "name": "Gaushala"}]}
            return {"daily": {
                "weather_code": [code], "temperature_2m_max": [24.0],
                "temperature_2m_min": [12.0], "precipitation_probability_max": [rain],
            }}
        return fetch

    def test_rain_alert(self):
        from unittest import mock
        event = make_event(self.organizer, days_from_now=3)
        with mock.patch("events.weather.fetch_json", side_effect=self.fake_fetch()):
            data = APIClient().get(f"/api/events/{event.id}/weather/").data
        self.assertTrue(data["available"])
        self.assertEqual(data["alert"], "rain")
        self.assertEqual(data["summary"], "Light rain")
        self.assertEqual(data["place"], "Gaushala")

    def test_too_far_ahead(self):
        event = make_event(self.organizer, days_from_now=40)
        data = APIClient().get(f"/api/events/{event.id}/weather/").data
        self.assertFalse(data["available"])
        self.assertEqual(data["reason"], "too_far")

    def test_service_down_is_handled(self):
        from unittest import mock
        event = make_event(self.organizer, days_from_now=2)
        with mock.patch("events.weather.fetch_json", side_effect=OSError("offline")):
            data = APIClient().get(f"/api/events/{event.id}/weather/").data
        self.assertEqual(data, {"available": False, "reason": "unavailable"})


class SmartSearchTests(TestCase):

    def setUp(self):
        from django.core.cache import cache
        cache.clear()   # throttle counters live in the cache
        self.organizer = User.objects.create_user(
            email="org@test.com", password="pw", role="ORGANIZER"
        )
        sat = datetime.date.today() + datetime.timedelta(days=(5 - datetime.date.today().weekday()) % 7 or 7)
        self.saturday = sat

        def ev(title, **kw):
            d = dict(
                organizer=self.organizer, title=title, description=title, category=Event.Category.WORKSHOP,
                location="Lalitpur", date=sat, start_time=datetime.time(10), end_time=datetime.time(12),
                capacity=20, price=0, status=Event.Status.PUBLISHED,
            )
            d.update(kw)
            return Event.objects.create(**d)

        self.match = ev("Python for beginners", tags="python,tech")
        ev("Paid python class", price=800, tags="python")
        ev("Python in Pokhara", location="Pokhara", tags="python")
        ev("Python next month", date=sat + datetime.timedelta(days=30), tags="python")
        ev("Jazz evening", category=Event.Category.CONCERT)

    def fake_claude(self, filters, stop_reason="end_turn"):
        from types import SimpleNamespace
        from unittest import mock
        response = SimpleNamespace(
            stop_reason=stop_reason,
            content=[SimpleNamespace(type="text", text=json.dumps(filters))],
        )
        client = mock.MagicMock()
        client.beta.messages.create.return_value = response
        return mock.patch("events.smart_search.get_client", return_value=client), client

    def filters(self, **kw):
        base = dict(keywords=[], category="", location="", date_from="", date_to="",
                    free_only=False, max_price=0, outdoor_only=False, summary="test")
        base.update(kw)
        return base

    def search(self, query="free tech workshops this weekend in Lalitpur"):
        return APIClient().post("/api/events/smart-search/", {"query": query}, format="json")

    def test_filters_are_applied(self):
        f = self.filters(keywords=["tech"], category="WORKSHOP", location="lalitpur",
                         date_from=str(self.saturday), date_to=str(self.saturday + datetime.timedelta(days=1)),
                         free_only=True)
        patch, client = self.fake_claude(f)
        with patch:
            res = self.search()
        self.assertEqual(res.status_code, 200)
        self.assertEqual([e["title"] for e in res.data["results"]], ["Python for beginners"])
        self.assertEqual(res.data["relaxed"], [])

        kwargs = client.beta.messages.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "claude-opus-5-5")
        self.assertEqual(kwargs["output_config"]["format"]["type"], "json_schema")
        self.assertIn("Today is", kwargs["messages"][0]["content"])

    def test_unknown_keywords_are_relaxed_not_empty(self):
        patch, _ = self.fake_claude(self.filters(keywords=["blockchain"], location="Lalitpur",
                                                 date_from=str(self.saturday), date_to=str(self.saturday)))
        with patch:
            res = self.search("blockchain stuff in lalitpur this weekend")
        self.assertEqual(res.data["relaxed"], ["keywords"])
        self.assertEqual(len(res.data["results"]), 3)   # everything else in Lalitpur that day

    def test_not_configured(self):
        from unittest import mock
        from events import smart_search
        with mock.patch.object(smart_search, "extract_filters",
                               side_effect=smart_search.SmartSearchUnavailable("not_configured")):
            res = self.search()
        self.assertEqual(res.status_code, 503)
        self.assertEqual(res.data["reason"], "not_configured")

    def test_refusal(self):
        patch, _ = self.fake_claude(self.filters(), stop_reason="refusal")
        with patch:
            res = self.search()
        self.assertEqual(res.data["reason"], "refused")

    def test_input_validation(self):
        self.assertEqual(self.search("").status_code, 400)
        self.assertEqual(self.search("x" * 300).status_code, 400)
