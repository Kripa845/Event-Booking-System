from django.urls import path

from .views import EsewaVerifyView, PaymentCancelView

urlpatterns = [
    path("payments/esewa/verify/", EsewaVerifyView.as_view()),
    path("payments/<str:transaction_uuid>/cancel/", PaymentCancelView.as_view()),
]
