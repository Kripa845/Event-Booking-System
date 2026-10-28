from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "created_at", "read_at")
    list_filter = ("read_at",)
    search_fields = ("user__email", "user__username", "title")
