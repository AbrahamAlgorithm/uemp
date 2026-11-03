from io import StringIO

import pytest
from django.core.management import call_command

from apps.academics.models import AcademicSession, Department, Faculty, Program, Semester
from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import CourseRegistration, SemesterRegistration
from apps.results.models import GradeScale, ResultEntry, ResultSheet

pytestmark = pytest.mark.django_db

SEEDED_MODELS = [
    Faculty,
    Department,
    Program,
    AcademicSession,
    Semester,
    User,
    StudentProfile,
    StaffProfile,
    Course,
    CourseOffering,
    CourseRegistration,
    GradeScale,
    ResultSheet,
    ResultEntry,
]


def seed(*args):
    out = StringIO()
    call_command("seed_demo", *args, stdout=out)
    return out.getvalue()


def row_counts():
    return {model.__name__: model.objects.count() for model in SEEDED_MODELS}


def test_running_twice_creates_no_duplicates():
    seed()
    first = row_counts()

    seed()

    assert row_counts() == first
    assert all(first.values())


def test_reset_rebuilds_the_same_data():
    seed()
    first = row_counts()

    seed("--reset")

    assert row_counts() == first


def test_current_semester_has_a_sheet_in_every_state_and_past_is_approved():
    seed()

    current = Semester.objects.get(is_current=True)
    current_states = ResultSheet.objects.filter(offering__semester=current).values_list("status", flat=True)
    past = ResultSheet.objects.exclude(offering__semester=current)

    assert set(current_states) == set(ResultSheet.Status.values)
    assert past.exists()
    assert not past.exclude(status=ResultSheet.Status.APPROVED).exists()


def test_accounts_use_the_seed_password(monkeypatch):
    monkeypatch.setenv("SEED_PASSWORD", "Another@2026")

    output = seed()

    assert User.objects.get(email="superadmin@uemp.test").check_password("Another@2026")
    assert "student1@uemp.test" in output


def test_every_staff_account_has_a_staff_profile():
    seed()

    staff = User.objects.filter(
        email__endswith="@uemp.test",
        role__in=[User.Role.LECTURER, User.Role.DEPT_ADMIN, User.Role.SUPER_ADMIN],
    )
    assert set(staff.values_list("role", flat=True)) == {"LECTURER", "DEPT_ADMIN", "SUPER_ADMIN"}
    assert StaffProfile.objects.filter(user__in=staff).count() == staff.count() == 11


def test_students_entry_session_matches_their_matric_year():
    seed()

    students = StudentProfile.objects.select_related("entry_session")
    assert students.exists()
    assert all(student.entry_session.name[:4] == student.matric_no.split("/")[1] for student in students)


def test_no_seeded_account_can_reach_the_django_admin():
    seed()

    seeded = User.objects.filter(email__endswith="@uemp.test")
    assert seeded.filter(role=User.Role.SUPER_ADMIN).exists()
    assert not seeded.filter(is_staff=True).exists()
    assert not seeded.filter(is_superuser=True).exists()


def test_student1_sees_a_preselected_carry_over_and_has_not_submitted(client):
    seed()
    client.post(
        "/api/auth/login/",
        {"identifier": "student1@uemp.test", "password": "Demo@2026"},
        content_type="application/json",
    )

    body = client.get("/api/student/registration/").json()

    assert body["registration"] is None and body["registration_open"]
    carry_overs = [course for course in body["courses"] if course["is_carry_over"]]
    assert [(course["code"], course["is_selected"]) for course in carry_overs] == [("CSC 201", True)]


def test_current_forms_cover_every_status_and_sheets_only_hold_validated_students():
    seed()

    current = Semester.objects.get(is_current=True)
    statuses = set(SemesterRegistration.objects.filter(semester=current).values_list("status", flat=True))
    assert statuses == set(SemesterRegistration.Status.values)
    assert not ResultEntry.objects.exclude(registration__semester_registration__status="VALIDATED").exists()
    assert not SemesterRegistration.objects.exclude(semester=current).exclude(status="VALIDATED").exists()
