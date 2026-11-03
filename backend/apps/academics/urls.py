from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import CurrentSemesterView, DepartmentViewSet, FacultyViewSet, ProgramViewSet, SemesterViewSet, SessionViewSet

router = SimpleRouter()
router.register("faculties", FacultyViewSet, basename="faculty")
router.register("departments", DepartmentViewSet, basename="department")
router.register("sessions", SessionViewSet, basename="session")
router.register("semesters", SemesterViewSet, basename="semester")
router.register("programs", ProgramViewSet, basename="program")

# ahead of the router, which would read "current" as a semester id
urlpatterns = [
    path("semesters/current/", CurrentSemesterView.as_view(), name="current-semester"),
    path(
        "semesters/<int:pk>/set-current/",
        SemesterViewSet.as_view({"post": "set_current"}),
        name="semester-set-current",
    ),
    path("", include(router.urls)),
]
