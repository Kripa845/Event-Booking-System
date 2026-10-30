"""
Admin actions on organizer accounts: approve, reject, suspend, create.

Allowed status changes:
  PENDING   -> APPROVED or REJECTED
  APPROVED  -> SUSPENDED
  REJECTED  -> APPROVED   (admin changed their mind)
  SUSPENDED -> APPROVED   (re-approve)
"""
from notifications.services import notify

from .emails import send_organizer_status_email
from .models import User

Status = User.OrganizerStatus

ALLOWED_FROM = {
    Status.APPROVED: {Status.PENDING, Status.REJECTED, Status.SUSPENDED},
    Status.REJECTED: {Status.PENDING},
    Status.SUSPENDED: {Status.APPROVED},
}


class OrganizerError(Exception):
    pass


def change_status(user_id, new_status, reason=""):
    user = User.objects.filter(id=user_id, role=User.Role.ORGANIZER).first()
    if not user:
        raise OrganizerError("Organizer not found.")
    if user.organizer_status not in ALLOWED_FROM[new_status]:
        raise OrganizerError(
            f"Can't change a {user.organizer_status.lower()} organizer to {new_status.lower()}."
        )

    user.set_organizer_status(new_status, (reason or "").strip()[:255])
    send_organizer_status_email(user, new_status, user.status_reason)
    if new_status == Status.APPROVED:
        notify(user, "You're approved! 🎤", "Your organizer account is active. Create your first event.")
    return user


def create_organizer(email, username, password, organization_name=""):
    """An organizer added directly by an admin is approved straight away."""
    email = (email or "").strip()
    if not email or not password:
        raise OrganizerError("Email and temporary password are required.")
    if len(password) < 8:
        raise OrganizerError("The temporary password must be at least 8 characters.")
    if User.objects.filter(email__iexact=email).exists():
        raise OrganizerError("An account with this email already exists.")
    username = (username or "").strip() or email.split("@")[0]
    if User.objects.filter(username__iexact=username).exists():
        raise OrganizerError("That username is taken.")

    return User.objects.create_user(
        email=email,
        username=username,
        password=password,
        role=User.Role.ORGANIZER,
        is_approved=True,
        organizer_status=Status.APPROVED,
        organization_name=(organization_name or "").strip(),
    )
