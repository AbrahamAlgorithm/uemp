from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import (
    GradeScaleResetView,
    GradeScaleView,
    LecturerOfferingViewSet,
    LecturerSubmissionsView,
    ResultSheetViewSet,
    StudentResultsView,
)

router = SimpleRouter()
router.register("lecturer/offerings", LecturerOfferingViewSet, basename="lecturer-offering")
router.register("result-sheets", ResultSheetViewSet, basename="result-sheet")

urlpatterns = [
    path("grade-scale/", GradeScaleView.as_view(), name="grade-scale"),
    path("grade-scale/reset/", GradeScaleResetView.as_view(), name="grade-scale-reset"),
    path("lecturer/submissions/", LecturerSubmissionsView.as_view(), name="lecturer-submissions"),
    path("student/results/", StudentResultsView.as_view(), name="student-results"),
    path("", include(router.urls)),
]
