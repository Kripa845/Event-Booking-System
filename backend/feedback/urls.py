from django.urls import path

from .views import PostcardListView, RateEventView

urlpatterns = [
    path("postcards/", PostcardListView.as_view()),
    path("postcards/<int:event_id>/rate/", RateEventView.as_view()),
]
