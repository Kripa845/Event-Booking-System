from .models import Follow, Notification


def notify(user, title, message, key=""):
    """
    Send one in-app notification to a user.
    With a key, a notification with the same key for this user is only sent once.
    """
    if key:
        notification, _ = Notification.objects.get_or_create(
            user=user, key=key, defaults={"title": title, "message": message},
        )
        return notification
    return Notification.objects.create(user=user, title=title, message=message)


def notify_followers(event):
    """Tell an organizer's followers about a newly published event (once per event)."""
    follows = Follow.objects.filter(organizer=event.organizer).select_related("follower")
    for follow in follows:
        notify(
            follow.follower,
            f"New from {event.organizer.username} ✨",
            f"{event.title} on {event.date:%b %d} in {event.location}. Grab a seat before it sells out!",
            key=f"new-event:{event.id}",
        )
