from django.urls import path

from .views import EventReviewsView, PostcardListView, RateEventView

urlpatterns = [
    path("postcards/", PostcardListView.as_view()),
    path("postcards/<int:event_id>/rate/", RateEventView.as_view()),
    path("events/<int:event_id>/reviews/", EventReviewsView.as_view()),
]
