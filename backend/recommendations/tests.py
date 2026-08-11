from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from events.models import Event
from bookings.models import Booking
from recommendations.services import get_recommendations

User = get_user_model()

class RecommendationSystemTests(APITestCase):

    def setUp(self):
        # 1. Create Users
        self.user_a = User.objects.create_user(email="user_a@test.com", username="user_a", password="password123")
        self.user_b = User.objects.create_user(email="user_b@test.com", username="user_b", password="password123")
        self.user_c = User.objects.create_user(email="user_c@test.com", username="user_c", password="password123")
        self.organizer = User.objects.create_user(email="org@test.com", username="org", role="ORGANIZER", password="password123")

        today = timezone.now().date()

        # 2. Create Upcoming Events
        self.event_django = Event.objects.create(
            organizer=self.organizer,
            title="Python Django Backend Workshop",
            description="Build scalable APIs with Django REST Framework and Python.",
            category=Event.Category.WORKSHOP,
            tags="python,django,backend,api",
            location="Hall A",
            date=today + timedelta(days=5),
            start_time="09:00:00",
            end_time="17:00:00",
            capacity=100,
            price=10.00,
            status=Event.Status.PUBLISHED
        )

        self.event_react = Event.objects.create(
            organizer=self.organizer,
            title="React Frontend Development",
            description="Master React hooks, state management, and Vite.",
            category=Event.Category.WORKSHOP,
            tags="react,frontend,javascript,hooks,web",
            location="Hall B",
            date=today + timedelta(days=6),
            start_time="09:00:00",
            end_time="17:00:00",
            capacity=100,
            price=0.00,
            status=Event.Status.PUBLISHED
        )

        self.event_python = Event.objects.create(
            organizer=self.organizer,
            title="Python Programming for Beginners",
            description="Introduction to Python programming language syntax and data types.",
            category=Event.Category.WORKSHOP,
            tags="python,programming,beginner",
            location="Hall A",
            date=today + timedelta(days=7),
            start_time="10:00:00",
            end_time="13:00:00",
            capacity=50,
            price=5.00,
            status=Event.Status.PUBLISHED
        )

        self.event_football = Event.objects.create(
            organizer=self.organizer,
            title="Football Tournament Finals",
            description="Watch the thrilling local league football finals match.",
            category=Event.Category.SPORTS,
            tags="football,sports,match,tournament",
            location="City Stadium",
            date=today + timedelta(days=8),
            start_time="14:00:00",
            end_time="17:00:00",
            capacity=500,
            price=15.00,
            status=Event.Status.PUBLISHED
        )

        self.event_cricket = Event.objects.create(
            organizer=self.organizer,
            title="Cricket League Championship",
            description="Exciting local cricket league championship match.",
            category=Event.Category.SPORTS,
            tags="cricket,sports,match,tournament",
            location="City Ground",
            date=today + timedelta(days=9),
            start_time="12:00:00",
            end_time="16:00:00",
            capacity=400,
            price=12.00,
            status=Event.Status.PUBLISHED
        )

        # 3. Create Past and Inactive Events (should never be recommended)
        self.event_past = Event.objects.create(
            organizer=self.organizer,
            title="Past Python Seminar",
            description="Introduction to Python seminar from last month.",
            category=Event.Category.SEMINAR,
            tags="python,seminar",
            location="Hall A",
            date=today - timedelta(days=30),
            start_time="09:00:00",
            end_time="12:00:00",
            capacity=100,
            price=0.00,
            status=Event.Status.PUBLISHED
        )

        self.event_draft = Event.objects.create(
            organizer=self.organizer,
            title="Draft Python Masterclass",
            description="Advanced Python workshop in draft mode.",
            category=Event.Category.WORKSHOP,
            tags="python,advanced",
            location="Hall A",
            date=today + timedelta(days=15),
            start_time="09:00:00",
            end_time="17:00:00",
            capacity=30,
            price=50.00,
            status=Event.Status.DRAFT
        )

        # Event with missing description and tags (Edge case verification)
        self.event_missing_fields = Event.objects.create(
            organizer=self.organizer,
            title="Silent Seminar",
            description="",
            category=Event.Category.SEMINAR,
            tags="",
            location="Hall C",
            date=today + timedelta(days=20),
            start_time="09:00:00",
            end_time="11:00:00",
            capacity=50,
            price=0.00,
            status=Event.Status.PUBLISHED
        )

    def test_new_user_no_bookings_fallback(self):
        """
        Scenario 1: User with no bookings should receive fallback popular events.
        Let's book event_football for User C. This makes event_football popular.
        """
        Booking.objects.create(user=self.user_c, event=self.event_football, status=Booking.Status.CONFIRMED)
        
        # Request recommendations for User B (who has no bookings)
        recs = get_recommendations(self.user_b, limit=5)
        
        # Ensure we returned fallback events (recs list length > 0)
        self.assertTrue(len(recs) > 0)
        
        # The most popular event (event_football) should be ranked first in the recommendations
        recommended_events = [e[0] for e in recs]
        self.assertEqual(recommended_events[0], self.event_football)
        # All recommendations should have a score of 0.0 indicating it's a fallback recommendation
        self.assertEqual(recs[0][1], 0.0)

    def test_user_with_one_booking(self):
        """
        Scenario 2: User with one booking (Python/Django) should get Python-related recommendations.
        """
        # User A books the Django event
        Booking.objects.create(user=self.user_a, event=self.event_django, status=Booking.Status.CONFIRMED)

        recs = get_recommendations(self.user_a, limit=5)
        recommended_events = [e[0] for e in recs]

        # The already booked event (event_django) MUST NOT be in recommendations
        self.assertNotIn(self.event_django, recommended_events)

        # Python Programming for Beginners should be the top recommendation because it shares tags/title topics
        self.assertEqual(recommended_events[0], self.event_python)
        
        # Ensure tech event (React) has higher similarity score than sports event (Football/Cricket)
        react_idx = recommended_events.index(self.event_react)
        football_idx = recommended_events.index(self.event_football)
        self.assertTrue(react_idx < football_idx)

    def test_user_with_multiple_bookings(self):
        """
        Scenario 3: User with multiple bookings (Django and Football) should receive mixed recommendations.
        """
        Booking.objects.create(user=self.user_a, event=self.event_django, status=Booking.Status.CONFIRMED)
        Booking.objects.create(user=self.user_a, event=self.event_football, status=Booking.Status.CONFIRMED)

        recs = get_recommendations(self.user_a, limit=5)
        recommended_events = [e[0] for e in recs]

        # Booked events must be excluded
        self.assertNotIn(self.event_django, recommended_events)
        self.assertNotIn(self.event_football, recommended_events)

        # Candidates are: event_react, event_python, event_cricket, event_missing_fields
        # Top recommendations should be event_python (similar to Django) and event_cricket (similar to Football)
        self.assertIn(self.event_python, recommended_events[:2])
        self.assertIn(self.event_cricket, recommended_events[:2])

    def test_cancelled_bookings_not_treated_as_interest(self):
        """
        Scenario 4: Cancelled bookings should be ignored in interest profiling.
        """
        # User A cancels their booking for event_django
        Booking.objects.create(user=self.user_a, event=self.event_django, status=Booking.Status.CANCELLED)

        # Set up a confirmed booking for User C to establish a popular event
        Booking.objects.create(user=self.user_c, event=self.event_football, status=Booking.Status.CONFIRMED)

        recs = get_recommendations(self.user_a, limit=10)
        
        # User A has no active bookings (since the only one is cancelled)
        # So they should receive the fallback popular list, and the score should be 0.0
        self.assertTrue(len(recs) > 0)
        self.assertEqual(recs[0][1], 0.0)
        # Also, since they cancelled event_django, it is technically an upcoming published event
        # and they don't have a confirmed booking, so it CAN be recommended as a candidate!
        recommended_events = [e[0] for e in recs]
        self.assertIn(self.event_django, recommended_events)

    def test_past_and_draft_events_excluded(self):
        """
        Scenario 8: Past and draft events must never be recommended.
        """
        Booking.objects.create(user=self.user_a, event=self.event_django, status=Booking.Status.CONFIRMED)

        recs = get_recommendations(self.user_a, limit=10)
        recommended_events = [e[0] for e in recs]

        # Past event must be excluded
        self.assertNotIn(self.event_past, recommended_events)
        # Draft event must be excluded
        self.assertNotIn(self.event_draft, recommended_events)

    def test_missing_fields_handling(self):
        """
        Scenario 6: Missing description and tags should not crash the recommendation generator.
        """
        # Book a normal event to trigger the similarity calculations (avoiding fallback)
        Booking.objects.create(user=self.user_a, event=self.event_django, status=Booking.Status.CONFIRMED)

        try:
            recs = get_recommendations(self.user_a, limit=5)
            recommended_events = [e[0] for e in recs]
            self.assertIn(self.event_missing_fields, recommended_events)
        except Exception as e:
            self.fail(f"get_recommendations raised an exception on missing description/tags: {str(e)}")

    def test_api_endpoint_response_structure_and_auth(self):
        """
        Verify the API endpoint GET /api/recommendations/ works, enforces authentication,
        and returns the required JSON structure.
        """
        # Try unauthenticated request first
        res = self.client.get('/api/recommendations/')
        self.assertEqual(res.status_code, 401)

        # Authenticate User A
        self.client.force_authenticate(user=self.user_a)
        res = self.client.get('/api/recommendations/')
        self.assertEqual(res.status_code, 200)

        # Verify response structure
        self.assertIn("recommendations", res.data)
        recs = res.data["recommendations"]
        self.assertTrue(isinstance(recs, list))
        
        # Verify fields in recommendation objects
        if len(recs) > 0:
            first_rec = recs[0]
            self.assertIn("id", first_rec)
            self.assertIn("title", first_rec)
            self.assertIn("similarity", first_rec)
            self.assertIn("category", first_rec)
            self.assertIn("date", first_rec)
            self.assertIn("location", first_rec)
