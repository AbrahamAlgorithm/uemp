import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.academics.models import AcademicSession, Department, Faculty, Program
from apps.accounts.models import StaffProfile, StudentProfile, User

PASSWORD = "Demo@2026"


@pytest.fixture(autouse=True)
def fast_password_hashing(settings):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def reset_login_throttle():
    # throttle counts live in the cache and would carry over between tests
    cache.clear()


@pytest.fixture
def csc(db):
    faculty = Faculty.objects.create(name="Faculty of Science", code="SCI")
    return Department.objects.create(faculty=faculty, name="Computer Science", code="CSC")


@pytest.fixture
def eee(db):
    faculty = Faculty.objects.create(name="Faculty of Engineering", code="ENG")
    return Department.objects.create(faculty=faculty, name="Electrical and Electronics Engineering", code="EEE")


def make_user(email, role, department=None, matric_no=None, staff_id=None, program=None):
    user = User.objects.create_user(
        email=email, password=PASSWORD, role=role, department=department, first_name="Ada", last_name="Obi"
    )
    if matric_no:
        session, _ = AcademicSession.objects.get_or_create(name="2024/2025")
        StudentProfile.objects.create(
            user=user, matric_no=matric_no, program=program, level=300, gender="F", entry_session=session
        )
    if staff_id:
        StaffProfile.objects.create(user=user, staff_id=staff_id, title="Dr.")
    return user


@pytest.fixture
def people(csc):
    program = Program.objects.create(department=csc, name="Computer Science", award="B.Sc.", duration_years=4)
    return {
        User.Role.STUDENT: make_user(
            "student@uemp.test", User.Role.STUDENT, csc, matric_no="CSC/2024/0001", program=program
        ),
        User.Role.LECTURER: make_user("lecturer@uemp.test", User.Role.LECTURER, csc, staff_id="CVU/CSC/073"),
        User.Role.DEPT_ADMIN: make_user("admin.csc@uemp.test", User.Role.DEPT_ADMIN, csc, staff_id="CVU/CSC/017"),
        User.Role.SUPER_ADMIN: make_user("superadmin@uemp.test", User.Role.SUPER_ADMIN, staff_id="CVU/REG/010"),
    }


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def sign_in(api):
    def sign_in(identifier, password=PASSWORD, client=None, **extra):
        return (client or api).post(
            reverse("auth-login"), {"identifier": identifier, "password": password}, format="json", **extra
        )

    return sign_in
