from decimal import Decimal

import pytest
from django.db import IntegrityError

from apps.academics.models import AcademicSession, Department, Faculty, Program, Semester
from apps.accounts.models import StudentProfile, User
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import CourseRegistration
from apps.results.models import GradeScale, ResultEntry, ResultSheet

pytestmark = pytest.mark.django_db


@pytest.fixture
def department():
    faculty = Faculty.objects.create(name="Science", code="SCI")
    return Department.objects.create(faculty=faculty, name="Computer Science", code="CSC")


@pytest.fixture
def program(department):
    return Program.objects.create(department=department, name="B.Sc. Computer Science", duration_years=4)


@pytest.fixture
def semester():
    session = AcademicSession.objects.create(name="2026/2027")
    return Semester.objects.create(session=session, term=Semester.Term.FIRST, is_current=True)


@pytest.fixture
def offering(department, semester):
    course = Course.objects.create(
        department=department,
        code="CSC 301",
        title="Operating Systems",
        units=3,
        level=300,
        semester_term=Semester.Term.FIRST,
    )
    return CourseOffering.objects.create(course=course, semester=semester)


@pytest.fixture
def student(department, program):
    user = User.objects.create_user(email="student@example.com", role=User.Role.STUDENT, department=department)
    return StudentProfile.objects.create(user=user, matric_no="CSC/2024/0001", program=program, level=300)


def test_new_offering_gets_a_draft_result_sheet(offering):
    assert offering.result_sheet.status == ResultSheet.Status.DRAFT


def test_only_one_semester_can_be_current(semester):
    with pytest.raises(IntegrityError):
        Semester.objects.create(session=semester.session, term=Semester.Term.SECOND, is_current=True)


def test_valid_role_and_department_pairs_save(department):
    User.objects.create_user(email="registry@example.com", role=User.Role.SUPER_ADMIN)
    User.objects.create_user(email="lecturer@example.com", role=User.Role.LECTURER, department=department)


@pytest.mark.parametrize(
    ("role", "with_department"),
    [(User.Role.SUPER_ADMIN, True), (User.Role.LECTURER, False), (User.Role.STUDENT, False)],
)
def test_department_rule_is_enforced(department, role, with_department):
    with pytest.raises(IntegrityError):
        User.objects.create_user(
            email="user@example.com",
            role=role,
            department=department if with_department else None,
        )


def test_student_department_comes_from_program(student, department):
    assert student.department == department


def test_student_level_must_be_a_whole_level(student):
    student.level = 250
    with pytest.raises(IntegrityError):
        student.save()


@pytest.mark.parametrize(("ca", "exam"), [("30.50", "60"), ("20", "70.25"), ("-1", "50")])
def test_scores_outside_ca_and_exam_limits_are_rejected(student, offering, ca, exam):
    registration = CourseRegistration.objects.create(student=student, offering=offering)
    with pytest.raises(IntegrityError):
        ResultEntry.objects.create(
            registration=registration,
            ca_score=Decimal(ca),
            exam_score=Decimal(exam),
            total=Decimal(ca) + Decimal(exam),
            grade="A",
            grade_point=Decimal("5"),
        )


def test_grade_band_min_cannot_exceed_max():
    with pytest.raises(IntegrityError):
        GradeScale.objects.create(min_score=70, max_score=60, grade="A", point=Decimal("5"))
