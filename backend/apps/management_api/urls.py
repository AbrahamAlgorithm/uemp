from rest_framework.routers import SimpleRouter
from django.urls import include, path

from .views import (
    ChangePasswordView,
    CourseViewSet,
    CurrentSemesterView,
    DepartmentViewSet,
    FacultyViewSet,
    GradeScaleView,
    OfferingViewSet,
    ProgramViewSet,
    SessionViewSet,
    SemesterViewSet,
    StaffViewSet,
    StudentViewSet,
    UserViewSet,
)

router = SimpleRouter()
router.register("faculties", FacultyViewSet, basename="faculty")
router.register("departments", DepartmentViewSet, basename="department")
router.register("sessions", SessionViewSet, basename="session")
router.register("semesters", SemesterViewSet, basename="semester")
router.register("programs", ProgramViewSet, basename="program")
router.register("students", StudentViewSet, basename="student")
router.register("staff", StaffViewSet, basename="staff")
router.register("lecturers", StaffViewSet, basename="lecturer")
router.register("courses", CourseViewSet, basename="course")
router.register("offerings", OfferingViewSet, basename="offering")
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("semesters/current/", CurrentSemesterView.as_view(), name="current-semester"),
    path(
        "semesters/<int:pk>/set-current/",
        SemesterViewSet.as_view({"post": "set_current"}),
        name="semester-set-current",
    ),
    path(
        "users/<int:pk>/reset-password/",
        UserViewSet.as_view({"post": "reset_password"}),
        name="user-reset-password",
    ),
    path("grade-scale/", GradeScaleView.as_view(), name="grade-scale"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("", include(router.urls)),
]
