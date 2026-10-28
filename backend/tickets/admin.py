from django.contrib import admin

from .models import Attendance


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("attendee_name", "event", "entered_at", "scanned_by")
    list_filter = ("event",)
    search_fields = ("attendee_name", "ticket__ticket_number")
