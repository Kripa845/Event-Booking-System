from django.core.mail import send_mail

SUBJECTS = {
    "APPROVED": "Your EventHub organizer account is approved",
    "REJECTED": "Your EventHub organizer application",
    "SUSPENDED": "Your EventHub organizer account is suspended",
}

BODIES = {
    "APPROVED": "Good news! An admin approved your organizer account. You can now sign in and create events.",
    "REJECTED": "Thanks for applying. Unfortunately your organizer application was not approved.",
    "SUSPENDED": "Your organizer account has been suspended, so you can't manage events for now.",
}


def send_organizer_status_email(user, status, reason=""):
    """Tell an organizer their account was approved, rejected or suspended."""
    body = f"Hi {user.username},\n\n{BODIES[status]}"
    if reason:
        body += f"\n\nReason: {reason}"
    body += "\n\n— The EventHub team"
    send_mail(SUBJECTS[status], body, None, [user.email], fail_silently=True)
