"""Send a notification to everyone holding a confirmed ticket for an event."""
from bookings.models import Booking
from notifications.services import notify


def notify_ticket_holders(event, title, message, key_prefix=""):
    bookings = Booking.objects.filter(event=event, status=Booking.Status.CONFIRMED).select_related("user")
    for booking in bookings:
        key = f"{key_prefix}:{booking.id}" if key_prefix else ""
        notify(booking.user, title, message, key=key)
    return len(bookings)
