from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import (
    ChangePasswordView,
    CsrfView,
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    StaffViewSet,
    StudentViewSet,
    UserViewSet,
)

# the default list is mounted at /api/auth/, account management below it at /api/
urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
]

router = SimpleRouter()
router.register("students", StudentViewSet, basename="student")
router.register("staff", StaffViewSet, basename="staff")
router.register("lecturers", StaffViewSet, basename="lecturer")
router.register("users", UserViewSet, basename="user")

management_urlpatterns = [
    path(
        "users/<int:pk>/reset-password/",
        UserViewSet.as_view({"post": "reset_password"}),
        name="user-reset-password",
    ),
    path("", include(router.urls)),
]
