from rest_framework.permissions import BasePermission


class IsOrganizerOrAdmin(BasePermission):
    """
    Admins, or organizers whose account is APPROVED.

    Checked on every request (JWT loads the user fresh from the database), so
    suspending an organizer locks them out at once, even with a valid token.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.role == "ADMIN":
            return True
        if user.role != "ORGANIZER":
            return False

        blocked = user.organizer_block()
        if blocked:
            code, message = blocked
            # A dict message is returned as the response body, so the frontend gets
            # {"error", "code"} and can log the organizer out with this message.
            self.message = {"error": message, "code": code}
            return False
        return True


class CanCheckIn(IsOrganizerOrAdmin):
    """
    Approved organizers and admins, or customers the organizer added as door staff.
    Which events a staff member may scan is checked per ticket (tickets.checkin.can_manage).
    """

    def has_permission(self, request, view):
        if super().has_permission(request, view):
            return True
        user = request.user
        return user.is_authenticated and user.role == "CUSTOMER" and user.door_events.exists()
