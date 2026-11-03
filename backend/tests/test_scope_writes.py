import pytest

from apps.academics.models import Program
from apps.courses.models import Course, CourseOffering

from .conftest import offer

pytestmark = pytest.mark.django_db


def test_programs_created_by_a_department_admin_land_in_their_own_department(staff, csc, mth, sign_in, api):
    sign_in("admin.csc@uemp.test")
    body = {"name": "Planted", "award": "B.Sc.", "duration_years": 4, "department": mth.pk}

    response = api.post("/api/programs/", body, format="json")

    assert response.status_code == 201
    assert Program.objects.get(name="Planted").department == csc


def test_a_department_admin_cannot_move_a_program_to_another_department(people, staff, csc, mth, sign_in, api):
    program = Program.objects.filter(department=csc).first()
    sign_in("admin.csc@uemp.test")

    api.patch(f"/api/programs/{program.pk}/", {"department": mth.pk}, format="json")

    program.refresh_from_db()
    assert program.department == csc


def test_a_department_admin_cannot_edit_another_departments_program(people, staff, mth, sign_in, api):
    other = Program.objects.create(department=mth, name="Statistics", award="B.Sc.", duration_years=4)
    sign_in("admin.csc@uemp.test")

    assert api.patch(f"/api/programs/{other.pk}/", {"name": "Changed"}, format="json").status_code == 404
    assert api.delete(f"/api/programs/{other.pk}/").status_code == 404


def test_a_super_admin_still_picks_the_programs_department(staff, csc, mth, sign_in, api):
    sign_in("superadmin@uemp.test")

    response = api.post("/api/programs/", {"name": "Statistics", "award": "B.Sc.", "duration_years": 4, "department": mth.pk}, format="json")

    assert response.status_code == 201
    assert Program.objects.get(name="Statistics").department == mth


def test_a_department_admin_cannot_open_another_departments_course_for_a_semester(mth301, calendar, sign_in, api):
    course = mth301["offering"].course
    sign_in("admin.csc@uemp.test")

    response = api.post("/api/offerings/", {"course": course.pk, "semester": calendar["past_first"].pk}, format="json")

    assert response.status_code == 404
    assert not CourseOffering.objects.filter(course=course, semester=calendar["past_first"]).exists()


def test_a_department_admin_opens_their_own_course(mth301, staff, csc, calendar, sign_in, api):
    course = Course.objects.create(department=csc, code="CSC 399", title="CSC 399", units=2, level=300, semester_term="FIRST")
    sign_in("admin.csc@uemp.test")

    response = api.post("/api/offerings/", {"course": course.pk, "semester": calendar["current"].pk}, format="json")

    assert response.status_code == 201


def test_an_offerings_course_and_semester_cannot_be_changed(mth301, staff, csc, calendar, sign_in, api):
    own = offer("CSC 399", csc, calendar["current"], staff["csc_lecturer"])
    other_course = Course.objects.create(department=csc, code="CSC 398", title="CSC 398", units=2, level=300, semester_term="FIRST")
    sign_in("admin.csc@uemp.test")

    assert api.patch(f"/api/offerings/{own.pk}/", {"course": other_course.pk}, format="json").status_code == 400
    assert api.patch(f"/api/offerings/{own.pk}/", {"semester": calendar["past_first"].pk}, format="json").status_code == 400
    own.refresh_from_db()
    assert own.course.code == "CSC 399"
