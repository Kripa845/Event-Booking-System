"""
Run once a day (e.g. Windows Task Scheduler or cron):  python manage.py daily_tasks

- Marks events whose date has passed as COMPLETED.
- Reminds ticket holders about events happening tomorrow (each person only once).
"""
import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from events.announcements import notify_ticket_holders
from events.models import Event
from events.status import OPEN, complete_past_events
from payments.services import release_expired


class Command(BaseCommand):
    help = "Complete past events and send reminders for tomorrow's events."

    def handle(self, *args, **options):
        release_expired()   # unpaid orders that timed out give their seats back
        completed = complete_past_events()

        tomorrow = timezone.localdate() + datetime.timedelta(days=1)
        reminded = 0
        for event in Event.objects.filter(status__in=OPEN, date=tomorrow):
            reminded += notify_ticket_holders(
                event,
                "See you tomorrow! ⏰",
                f"{event.title} starts tomorrow at {event.start_time.strftime('%I:%M %p').lstrip('0')}, "
                f"{event.venue + ', ' if event.venue else ''}{event.location}. Don't forget your QR ticket.",
                key_prefix=f"reminder:{event.id}",
            )

        self.stdout.write(f"Completed {completed} past event(s); sent {reminded} reminder(s).")
