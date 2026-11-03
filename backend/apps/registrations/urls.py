from django.urls import include, path
from rest_framework.routers import SimpleRouter

from .views import (
    CourseRegistrationViewSet,
    RegistrationFormViewSet,
    RegistrationSlipView,
    StudentRegistrationHistoryView,
    StudentRegistrationView,
)

router = SimpleRouter()
router.register("registration-forms", RegistrationFormViewSet, basename="registration-form")
router.register("registrations", CourseRegistrationViewSet, basename="registration")

urlpatterns = [
    path("student/registration/", StudentRegistrationView.as_view(), name="student-registration"),
    path("student/registration/slip/", RegistrationSlipView.as_view(), name="student-registration-slip"),
    path("student/registrations/", StudentRegistrationHistoryView.as_view(), name="student-registrations"),
    path("", include(router.urls)),
]
