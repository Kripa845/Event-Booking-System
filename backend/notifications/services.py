from .models import Notification


def notify(user, title, message):
    """Send one in-app notification to a user."""
    return Notification.objects.create(user=user, title=title, message=message)
