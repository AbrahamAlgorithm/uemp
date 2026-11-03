import pytest

from apps.academics.models import AcademicSession
from apps.accounts.models import User
from apps.results.models import ResultSheet

from .conftest import enrol, grade, offer, set_sheet

pytestmark = pytest.mark.django_db

Sheet = ResultSheet.Status


@pytest.fixture
def history(people, staff, calendar, csc):
    """The csc student failed CSC 201 and passed CSC 202 last session, so CGPA is 2.50."""
    student = people[User.Role.STUDENT]
    lecturer = staff["csc_lecturer"]
    first = offer("CSC 201", csc, calendar["past_first"], lecturer, level=200)
    second = offer("CSC 202", csc, calendar["past_second"], lecturer, level=200)
    grade(enrol(student.student_profile, first), 10, 15)
    grade(enrol(student.student_profile, second), 30, 50)
    set_sheet(first, Sheet.APPROVED)
    set_sheet(second, Sheet.APPROVED)
    return {"first": first, "second": second, "student": student.student_profile}


def test_dashboard_shows_identity_cgpa_and_outstanding_carry_overs(history, sign_in, api):
    sign_in("student@uemp.test")

    body = api.get("/api/student/dashboard/").json()

    assert body["matric_no"] == "CSC/2024/0001"
    assert (body["faculty"]["code"], body["department"]["code"], body["program"]["award"]) == ("SCI", "CSC", "B.Sc.")
    assert (body["level"], body["entry_session"], body["cgpa"]) == (300, "2024/2025", 2.5)
    assert body["carry_overs"] == [{"code": "CSC 201", "title": "CSC 201", "units": 3}]
    assert body["registration"] == {"status": "NOT_SUBMITTED", "return_reason": "", "registration_open": True}


def test_dashboard_registration_follows_the_form_and_the_window(history, calendar, sign_in, api):
    offering = offer("CSC 301", history["first"].course.department, calendar["current"], history["first"].lecturer.user)
    enrol(history["student"], offering, "SUBMITTED")
    sign_in("student@uemp.test")
    assert api.get("/api/student/dashboard/").json()["registration"]["status"] == "SUBMITTED"

    calendar["current"].registration_open = False
    calendar["current"].save()
    assert api.get("/api/student/dashboard/").json()["registration"]["registration_open"] is False


@pytest.mark.parametrize("email", ["lecturer@uemp.test", "admin.csc@uemp.test", "superadmin@uemp.test"])
def test_student_endpoints_are_for_students_only(history, email, sign_in, api):
    sign_in(email)
    for path in ("dashboard/", "sessions/", "courses/", "results/statement/"):
        assert api.get(f"/api/student/{path}").status_code == 403


def test_student_endpoints_need_a_session(api):
    assert api.get("/api/student/sessions/").status_code == 401


def test_sessions_run_from_entry_to_current_with_the_level_in_each(history, sign_in, api):
    sign_in("student@uemp.test")

    rows = api.get("/api/student/sessions/").json()

    assert [(r["name"], r["level"], r["label"], r["is_current"]) for r in rows] == [
        ("2026/2027", 300, "2026/2027 · 300 Level", True),
        ("2025/2026", 200, "2025/2026 · 200 Level", False),
        ("2024/2025", 100, "2024/2025 · 100 Level", False),
    ]


def test_my_courses_defaults_to_the_current_session(history, mth301, sign_in, api):
    sign_in("student@uemp.test")

    body = api.get("/api/student/courses/").json()

    assert body["session"]["name"] == "2026/2027"
    assert body["cgpa"] == 2.5
    assert [(s["semester"]["term"], s["is_current"], s["registration"]["status"]) for s in body["semesters"]] == [
        ("FIRST", True, "VALIDATED")
    ]
    assert [c["code"] for c in body["semesters"][0]["courses"]] == ["MTH 301"]


def test_a_past_session_lists_grades_and_a_gpa_per_semester(history, sign_in, api):
    sign_in("student@uemp.test")
    session = history["first"].semester.session

    body = api.get(f"/api/student/courses/?session={session.pk}").json()

    first, second = body["semesters"]
    assert (body["level"], first["gpa"], second["gpa"]) == (200, "0.00", "5.00")
    assert first["courses"][0]["code"] == "CSC 201"
    assert (first["courses"][0]["ca_score"], first["courses"][0]["exam_score"], first["courses"][0]["total"]) == ("10.00", "15.00", "25.00")
    assert (second["courses"][0]["grade"], second["courses"][0]["grade_point"]) == ("A", "5.00")
    assert first["total_units"] == 3


def test_a_retaken_failed_course_is_flagged_as_a_carry_over(history, calendar, sign_in, api):
    retake = offer("CSC 201", history["first"].course.department, calendar["current"], history["first"].lecturer.user)
    enrol(history["student"], retake)
    sign_in("student@uemp.test")

    course = api.get("/api/student/courses/").json()["semesters"][0]["courses"][0]

    assert (course["code"], course["is_carry_over"], course["grade"]) == ("CSC 201", True, None)


@pytest.mark.parametrize("status", [Sheet.DRAFT, Sheet.SUBMITTED, Sheet.REJECTED])
def test_my_courses_never_returns_grades_from_an_unapproved_sheet(history, status, sign_in, api):
    set_sheet(history["second"], status)
    sign_in("student@uemp.test")
    session = history["first"].semester.session

    body = api.get(f"/api/student/courses/?session={session.pk}").json()

    second = body["semesters"][1]
    assert second["gpa"] is None
    assert second["courses"][0]["code"] == "CSC 202"
    assert {second["courses"][0][key] for key in ("ca_score", "exam_score", "total", "grade", "grade_point")} == {None}
    assert body["cgpa"] == 0.0


def test_a_session_outside_the_students_enrolment_is_not_found(history, mth301, sign_in, api):
    later = AcademicSession.objects.create(name="2027/2028")
    sign_in("student@uemp.test")

    assert api.get(f"/api/student/courses/?session={later.pk}").status_code == 404
    assert api.get("/api/student/courses/?session=999999").status_code == 404
    assert api.get("/api/student/courses/?session=abc").status_code == 400


def test_a_session_without_semesters_has_nothing_to_show(history, sign_in, api):
    entry = AcademicSession.objects.get(name="2024/2025")
    sign_in("student@uemp.test")

    body = api.get(f"/api/student/courses/?session={entry.pk}").json()

    assert body["semesters"] == []
    assert body["level"] == 100


def test_statement_lists_approved_results_with_the_legend(history, mth301, sign_in, api):
    sign_in("student@uemp.test")

    body = api.get("/api/student/results/statement/").json()

    assert body["student"]["matric_no"] == "CSC/2024/0001"
    assert [s["semester"]["term"] for s in body["semesters"]] == ["FIRST", "SECOND"]
    assert [s["gpa"] for s in body["semesters"]] == ["0.00", "5.00"]
    assert (body["cgpa"], body["units_attempted"], body["units_passed"]) == ("2.50", 6, 3)
    assert [b["grade"] for b in body["bands"]] == ["A", "B", "C", "D", "E", "F"]
    assert body["generated_at"]


def test_statement_skips_sheets_that_are_not_approved(history, sign_in, api):
    set_sheet(history["second"], Sheet.SUBMITTED)
    sign_in("student@uemp.test")

    body = api.get("/api/student/results/statement/").json()

    assert [c["code"] for s in body["semesters"] for c in s["courses"]] == ["CSC 201"]


def test_student_views_use_a_bounded_number_of_queries(history, mth301, sign_in, api, django_assert_max_num_queries):
    sign_in("student@uemp.test")
    session = history["first"].semester.session

    with django_assert_max_num_queries(10):
        api.get("/api/student/dashboard/")
    with django_assert_max_num_queries(8):
        api.get("/api/student/sessions/")
    with django_assert_max_num_queries(14):
        api.get(f"/api/student/courses/?session={session.pk}")
    with django_assert_max_num_queries(12):
        api.get("/api/student/results/statement/")
