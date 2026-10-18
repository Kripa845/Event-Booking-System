from django.contrib import admin

from .models import EventFeedback


@admin.register(EventFeedback)
class EventFeedbackAdmin(admin.ModelAdmin):

    list_display = ("event", "user", "rating", "updated_at")
    list_filter = ("rating",)
    search_fields = ("event__title", "user__email")
