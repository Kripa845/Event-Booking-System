from django.contrib import admin

# Register your models here.
from django.contrib import admin

from .models import WaitlistEntry


@admin.register(WaitlistEntry)
class WaitlistEntryAdmin(admin.ModelAdmin):

    list_display = (
        "user",
        "event",
        "position",
        "joined_at",
    )

    list_filter = (
        "event",
    )

    search_fields = (
        "user__username",
        "event__title",
    )