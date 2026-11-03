import pytest

from apps.audit.models import AuditLog
from apps.courses.models import Course, CourseOffering
from apps.results.models import ResultSheet

from .conftest import set_sheet

pytestmark = pytest.mark.django_db

Sheet = ResultSheet.Status


def test_lecturer_dashboard_lists_current_offerings_and_what_needs_action(mth301, staff, calendar, mth, sign_in, api):
    other = Course.objects.create(department=mth, code="MTH 303", title="MTH 303", units=2, level=300, semester_term="FIRST")
    approved = CourseOffering.objects.create(course=other, semester=calendar["current"], lecturer=staff["mth_lecturer"].staff_profile)
    set_sheet(approved, Sheet.APPROVED)
    ResultSheet.objects.filter(offering=mth301["offering"]).update(status=Sheet.REJECTED, feedback="Recheck the CA column")
    sign_in("lecturer.mth@uemp.test")

    body = api.get("/api/lecturer/dashboard/").json()

    assert body["semester"]["term"] == "FIRST"
    rows = {row["course"]["code"]: row for row in body["offerings"]}
    assert rows["MTH 301"]["sheet_status"] == "REJECTED"
    assert rows["MTH 301"]["feedback"] == "Recheck the CA column"
    assert rows["MTH 301"]["student_count"] == 2
    assert rows["MTH 303"]["sheet_status"] == "APPROVED"
    assert body["needs_action"] == 1


def test_lecturer_dashboard_only_shows_the_lecturers_own_courses(mth301, sign_in, api):
    sign_in("lecturer@uemp.test")

    body = api.get("/api/lecturer/dashboard/").json()

    assert body["offerings"] == []
    assert body["needs_action"] == 0


def test_lecturer_semesters_list_only_semesters_they_teach_in(mth301, staff, calendar, sign_in, api):
    sign_in("lecturer.mth@uemp.test")
    assert [s["term"] for s in api.get("/api/lecturer/semesters/").json()] == ["FIRST"]

    sign_in("lecturer@uemp.test")
    assert api.get("/api/lecturer/semesters/").json() == []


def test_lecturer_offerings_carry_the_sheet_feedback(mth301, sign_in, api):
    ResultSheet.objects.filter(offering=mth301["offering"]).update(status=Sheet.REJECTED, feedback="Fix the exam column")
    sign_in("lecturer.mth@uemp.test")

    assert api.get("/api/lecturer/offerings/").json()[0]["feedback"] == "Fix the exam column"


@pytest.mark.parametrize("email", ["student@uemp.test", "admin.csc@uemp.test", "superadmin@uemp.test"])
def test_lecturer_dashboard_is_for_lecturers_only(mth301, email, sign_in, api):
    sign_in(email)
    assert api.get("/api/lecturer/dashboard/").status_code == 403


def test_department_dashboard_counts_only_its_own_department(mth301, staff, students, mth, sign_in, api):
    extra = Course.objects.create(department=mth, code="MTH 399", title="MTH 399", units=2, level=300, semester_term="FIRST")
    CourseOffering.objects.create(course=extra, semester=mth301["offering"].semester)
    set_sheet(mth301["offering"], Sheet.SUBMITTED)
    sign_in("admin.mth@uemp.test")

    body = api.get("/api/department/dashboard/").json()

    assert body["department"]["code"] == "MTH"
    assert body["counts"] == {"students": 1, "lecturers": 1, "courses": 2, "current_offerings": 2, "unallocated_offerings": 1}
    assert body["awaiting_review"] == 1
    assert body["awaiting_validation"] == 0


def test_department_dashboard_awaits_forms_by_student_department(mth301, sign_in, api):
    sign_in("admin.csc@uemp.test")

    body = api.get("/api/department/dashboard/").json()

    assert body["awaiting_validation"] == 1
    assert body["awaiting_review"] == 0
    assert body["counts"]["students"] == 2


def test_department_dashboard_lists_the_last_ten_of_its_own_audit_rows(mth301, sign_in, api):
    for number in range(12):
        AuditLog.objects.create(action="UPDATE", entity_type="x", entity_id=str(number), department=mth301["offering"].course.department)
    AuditLog.objects.create(action="UPDATE", entity_type="x", entity_id="csc", department=mth301["csc"].student.program.department)
    sign_in("admin.mth@uemp.test")

    rows = api.get("/api/department/dashboard/").json()["recent_activity"]

    assert len(rows) == 10
    assert {row["department"]["code"] for row in rows} == {"MTH"}


@pytest.mark.parametrize("email", ["student@uemp.test", "lecturer@uemp.test", "superadmin@uemp.test"])
def test_department_dashboard_is_for_department_admins_only(mth301, email, sign_in, api):
    sign_in(email)
    assert api.get("/api/department/dashboard/").status_code == 403


def test_admin_dashboard_totals_and_one_row_per_department(mth301, eee, sign_in, api):
    set_sheet(mth301["offering"], Sheet.SUBMITTED)
    sign_in("superadmin@uemp.test")

    body = api.get("/api/admin/dashboard/").json()

    assert body["totals"]["students"] == 3
    assert body["totals"]["departments"] == 3
    assert (body["totals"]["awaiting_validation"], body["totals"]["awaiting_review"]) == (1, 1)
    rows = {row["code"]: row for row in body["departments"]}
    assert (rows["CSC"]["students"], rows["CSC"]["awaiting_validation"], rows["CSC"]["awaiting_review"]) == (2, 1, 0)
    assert (rows["MTH"]["students"], rows["MTH"]["awaiting_validation"], rows["MTH"]["awaiting_review"]) == (1, 0, 1)
    assert (rows["EEE"]["students"], rows["EEE"]["awaiting_review"]) == (0, 0)


@pytest.mark.parametrize("email", ["student@uemp.test", "lecturer@uemp.test", "admin.csc@uemp.test"])
def test_admin_dashboard_is_for_super_admins_only(mth301, email, sign_in, api):
    sign_in(email)
    assert api.get("/api/admin/dashboard/").status_code == 403


def test_dashboards_use_a_bounded_number_of_queries(mth301, sign_in, api, django_assert_max_num_queries):
    for email, path, limit in (
        ("lecturer.mth@uemp.test", "lecturer/dashboard/", 8),
        ("admin.mth@uemp.test", "department/dashboard/", 14),
        ("superadmin@uemp.test", "admin/dashboard/", 14),
    ):
        sign_in(email)
        with django_assert_max_num_queries(limit):
            assert api.get(f"/api/{path}").status_code == 200
