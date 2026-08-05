from django.db.models.signals import post_save
from django.dispatch import receiver

from bookings.models import Booking

from .models import Ticket


@receiver(post_save, sender=Booking)
def create_ticket(sender, instance, created, **kwargs):

    if created:
        Ticket.objects.create(
            booking=instance
        )