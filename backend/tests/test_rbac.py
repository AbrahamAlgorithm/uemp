import pytest
from django.urls import include, path
from rest_framework import routers, serializers, viewsets
from rest_framework.response import Response
from rest_framework.test import APIClient
from rest_framework.views import APIView

from apps.academics.models import Semester
from apps.accounts.models import User
from apps.courses.models import Course
from core.permissions import HasRole, IsSuperAdmin
from core.scoping import DepartmentScopedQuerysetMixin, department_scope


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "code"]


class ScopedCourseViewSet(DepartmentScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.order_by("code")
    serializer_class = CourseSerializer
    permission_classes = [HasRole(User.Role.DEPT_ADMIN, User.Role.SUPER_ADMIN)]
    department_lookup = "department"


class AdminOnlyView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        return Response({"ok": True})

    def post(self, request):
        return Response(status=204)


router = routers.SimpleRouter()
router.register("courses", ScopedCourseViewSet, basename="scoped-course")

urlpatterns = [
    path("api/auth/", include("apps.accounts.urls")),
    path("api/test/admin-only/", AdminOnlyView.as_view()),
    path("api/test/", include(router.urls)),
]

pytestmark = [pytest.mark.django_db, pytest.mark.urls(__name__)]


@pytest.fixture
def courses(csc, eee):
    def course(department, code):
        return Course.objects.create(
            department=department, code=code, title=code, units=3, level=300, semester_term=Semester.Term.FIRST
        )

    return {"CSC": course(csc, "CSC 301"), "EEE": course(eee, "EEE 301")}


def test_department_admin_only_sees_their_department(people, courses, sign_in, api):
    sign_in("admin.csc@uemp.test")

    assert [row["code"] for row in api.get("/api/test/courses/").json()] == ["CSC 301"]
    assert api.get(f"/api/test/courses/{courses['CSC'].pk}/").status_code == 200
    assert api.get(f"/api/test/courses/{courses['EEE'].pk}/").status_code == 404


def test_super_admin_sees_every_department(people, courses, sign_in, api):
    sign_in("superadmin@uemp.test")

    assert [row["code"] for row in api.get("/api/test/courses/").json()] == ["CSC 301", "EEE 301"]
    assert api.get(f"/api/test/courses/{courses['EEE'].pk}/").status_code == 200


def test_wrong_role_gets_403(people, courses, sign_in, api):
    sign_in("student@uemp.test")

    assert api.get("/api/test/admin-only/").status_code == 403
    assert api.get(f"/api/test/courses/{courses['CSC'].pk}/").status_code == 403


def test_signed_out_requests_get_401(courses, api):
    assert api.get("/api/test/admin-only/").status_code == 401
    assert api.get("/api/test/courses/").status_code == 401


def test_department_scope(people):
    assert department_scope(people[User.Role.SUPER_ADMIN]) is None
    assert department_scope(people[User.Role.DEPT_ADMIN]).code == "CSC"


def test_cookie_auth_needs_the_csrf_token_on_unsafe_methods(people, sign_in):
    client = APIClient(enforce_csrf_checks=True)
    client.get("/api/auth/csrf/")
    token = client.cookies["csrftoken"].value
    sign_in("superadmin@uemp.test", client=client, HTTP_X_CSRFTOKEN=token)

    rejected = client.post("/api/test/admin-only/")
    assert rejected.status_code == 403
    assert rejected.json()["detail"].startswith("CSRF Failed")
    assert client.get("/api/test/admin-only/").status_code == 200
    assert client.post("/api/test/admin-only/", HTTP_X_CSRFTOKEN=token).status_code == 204
