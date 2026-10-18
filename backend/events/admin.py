from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import Event, Holiday


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):

    list_display = (
        "title",
        "organizer",
        "date",
        "location",
        "capacity",
        "price",
        "status",
    )

    list_filter = (
        "status",
        "date",
    )

    search_fields = (
        "title",
        "location",
    )


@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):

    list_display = ("name", "start_date", "end_date", "major")
    list_filter = ("major",)
    search_fields = ("name", "name_np")
