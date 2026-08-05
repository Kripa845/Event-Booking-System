from rest_framework.routers import DefaultRouter

from .views import WaitlistViewSet


router = DefaultRouter()

router.register(
    "waitlist",
    WaitlistViewSet,
    basename="waitlist",
)

urlpatterns = router.urls