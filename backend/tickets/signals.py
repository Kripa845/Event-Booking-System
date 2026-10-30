from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from bookings.models import Booking

from .emails import send_ticket_email
from .models import Ticket


@receiver(post_save, sender=Booking)
def create_ticket(sender, instance, created, **kwargs):

    # A ticket is issued once a booking is CONFIRMED: straight away for free events,
    # or after payment for paid ones. Pending (unpaid) bookings have no QR code.
    if instance.status == Booking.Status.CONFIRMED and not Ticket.objects.filter(booking=instance).exists():
        ticket = Ticket.objects.create(
            booking=instance
        )
        # Email only after the booking is really saved (not if the transaction rolls back).
        transaction.on_commit(lambda: send_ticket_email(ticket))