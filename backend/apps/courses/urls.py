from rest_framework.routers import SimpleRouter

from .views import CourseViewSet, OfferingViewSet

router = SimpleRouter()
router.register("courses", CourseViewSet, basename="course")
router.register("offerings", OfferingViewSet, basename="offering")

urlpatterns = router.urls
