from datetime import datetime, timezone

import pytest
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.academics.models import AcademicSession, Department, Faculty, Program, Semester
from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import CourseRegistration, SemesterRegistration

PASSWORD = "Demo@2026"
WHEN = datetime(2026, 10, 14, tzinfo=timezone.utc)
FIRST, SECOND = Semester.Term.FIRST, Semester.Term.SECOND


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


@pytest.fixture
def calendar(db):
    past = AcademicSession.objects.create(name="2025/2026")
    now = AcademicSession.objects.create(name="2026/2027")
    return {
        "past_first": Semester.objects.create(session=past, term=FIRST),
        "past_second": Semester.objects.create(session=past, term=SECOND),
        "current": Semester.objects.create(session=now, term=FIRST, is_current=True, registration_open=True),
    }


@pytest.fixture
def mth(csc):
    return Department.objects.create(faculty=csc.faculty, name="Mathematics", code="MTH")


@pytest.fixture
def staff(people, mth):
    return {
        "csc_lecturer": people[User.Role.LECTURER],
        "mth_lecturer": make_user("lecturer.mth@uemp.test", User.Role.LECTURER, mth, staff_id="CVU/MTH/052"),
        "mth_admin": make_user("admin.mth@uemp.test", User.Role.DEPT_ADMIN, mth, staff_id="CVU/MTH/012"),
    }


@pytest.fixture
def students(people, mth):
    csc_student = people[User.Role.STUDENT].student_profile
    maths = Program.objects.create(department=mth, name="Mathematics", award="B.Sc.", duration_years=4)
    return {
        "csc": csc_student,
        "mth": make_user(
            "maths@uemp.test", User.Role.STUDENT, mth, matric_no="MTH/2024/0002", program=maths
        ).student_profile,
        "late": make_user(
            "late@uemp.test", User.Role.STUDENT, csc_student.department, matric_no="CSC/2024/0003",
            program=csc_student.program,
        ).student_profile,
    }


def offer(code, department, semester, lecturer, units=3, level=300):
    course, _ = Course.objects.get_or_create(
        code=code,
        defaults={"department": department, "title": code, "units": units, "level": level, "semester_term": semester.term},
    )
    return CourseOffering.objects.create(course=course, semester=semester, lecturer=lecturer.staff_profile)


def enrol(student, offering, status=SemesterRegistration.Status.VALIDATED):
    form, _ = SemesterRegistration.objects.get_or_create(
        student=student, semester=offering.semester, defaults={"status": status, "submitted_at": WHEN}
    )
    return CourseRegistration.objects.create(student=student, offering=offering, semester_registration=form)


@pytest.fixture
def mth301(mth, staff, students, calendar):
    offering = offer("MTH 301", mth, calendar["current"], staff["mth_lecturer"])
    return {
        "offering": offering,
        "sheet": offering.result_sheet,
        "csc": enrol(students["csc"], offering),
        "mth": enrol(students["mth"], offering),
        "late": enrol(students["late"], offering, SemesterRegistration.Status.SUBMITTED),
    }
