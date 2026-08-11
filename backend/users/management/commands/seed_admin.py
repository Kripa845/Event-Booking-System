from django.core.management.base import BaseCommand
from users.models import User


class Command(BaseCommand):
    help = "Create / reset the default admin account (safe to run multiple times)."

    EMAIL    = "admin@eventhub.com"
    USERNAME = "admin"
    PASSWORD = "Admin@1234"

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(
            email=self.EMAIL,
            defaults={"username": self.USERNAME},
        )
        user.username     = self.USERNAME
        user.role         = User.Role.ADMIN
        user.is_approved  = True
        user.is_staff     = True
        user.is_superuser = True
        user.set_password(self.PASSWORD)
        user.save()

        verb = "Created" if created else "Reset"
        self.stdout.write(self.style.SUCCESS(f"\n✓ Admin {verb} successfully.\n"))
        self.stdout.write(f"  Email    : {self.EMAIL}")
        self.stdout.write(f"  Password : {self.PASSWORD}")
        self.stdout.write(f"  Username : {self.USERNAME}\n")
        self.stdout.write(
            self.style.WARNING("  Change the password before deploying to production!\n")
        )
