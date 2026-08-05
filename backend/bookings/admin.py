from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):

    list_display = (
        "user",
        "event",
        "status",
        "booked_at",
        "cancelled_at",
    )

    list_filter = (
        "status",
        "booked_at",
    )

    search_fields = (
        "user__username",
        "event__title",
    )