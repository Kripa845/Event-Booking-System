from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("transaction_uuid", "user", "event", "amount", "status", "ref_id", "created_at")
    list_filter = ("status",)
    search_fields = ("transaction_uuid", "ref_id", "user__email")
