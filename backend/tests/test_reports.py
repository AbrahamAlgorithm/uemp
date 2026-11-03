import csv
import io

import pytest

from apps.accounts.models import User
from apps.courses.models import Course, CourseOffering
from apps.results.models import ResultSheet

from .conftest import enrol, grade, offer, set_sheet

pytestmark = pytest.mark.django_db

Sheet = ResultSheet.Status


def table(response, index=0):
    return response.json()["tables"][index]["rows"]


def csv_rows(response):
    return list(csv.reader(io.StringIO(response.content.decode())))


@pytest.fixture
def graded(mth301):
    """MTH 301 approved: the csc student scores 75 (A) and the maths student 35 (F)."""
    grade(mth301["csc"], 30, 45)
    grade(mth301["mth"], 15, 20)
    set_sheet(mth301["offering"], Sheet.APPROVED)
    return mth301


def test_performance_counts_approved_sheets_only(graded, sign_in, api):
    sign_in("admin.mth@uemp.test")

    rows = table(api.get("/api/reports/performance/"))

    assert len(rows) == 1
    row = rows[0]
    assert (row["code"], row["count"], row["highest"], row["lowest"]) == ("MTH 301", 2, 75, 35)
    assert (row["average"], row["pass_rate"]) == (55, 50)
    assert (row["grade_A"], row["grade_B"], row["grade_F"]) == (1, 0, 1)


@pytest.mark.parametrize("status", [Sheet.DRAFT, Sheet.SUBMITTED, Sheet.REJECTED])
def test_performance_ignores_sheets_that_are_not_approved(graded, status, sign_in, api):
    set_sheet(graded["offering"], status)
    sign_in("admin.mth@uemp.test")

    response = api.get("/api/reports/performance/")

    assert table(response, 0) == []
    assert table(response, 1) == []


def test_performance_adds_the_average_gpa_per_student_level(graded, sign_in, api):
    sign_in("admin.mth@uemp.test")

    levels = table(api.get("/api/reports/performance/"), 1)

    assert [(r["level"], r["students"], r["average_gpa"]) for r in levels] == [(300, 2, 2.5)]


def test_performance_follows_the_semester_filter(graded, calendar, sign_in, api):
    sign_in("admin.mth@uemp.test")

    rows = table(api.get(f"/api/reports/performance/?semester={calendar['past_first'].pk}"))

    assert rows == []


def test_dept_admin_never_sees_another_departments_figures(graded, sign_in, api):
    sign_in("admin.csc@uemp.test")

    assert table(api.get("/api/reports/performance/")) == []
    assert table(api.get("/api/reports/performance/?department=%d" % graded["offering"].course.department_id)) == []


def test_super_admin_narrows_a_report_to_one_department(graded, mth, csc, sign_in, api):
    sign_in("superadmin@uemp.test")

    assert len(table(api.get("/api/reports/performance/"))) == 1
    assert len(table(api.get(f"/api/reports/performance/?department={mth.pk}"))) == 1
    assert table(api.get(f"/api/reports/performance/?department={csc.pk}")) == []
    assert api.get("/api/reports/performance/?department=999999").status_code == 404


def test_registrations_report_counts_registered_and_validated(mth301, sign_in, api):
    sign_in("admin.mth@uemp.test")

    rows = table(api.get("/api/reports/registrations/"))

    assert [(r["code"], r["units"], r["lecturer"], r["registered"], r["validated"]) for r in rows] == [
        ("MTH 301", 3, "Ada Obi", 3, 2)
    ]
    sign_in("admin.csc@uemp.test")
    assert table(api.get("/api/reports/registrations/")) == []


def test_registrations_report_marks_unallocated_courses(mth301, staff, calendar, mth, sign_in, api):
    course = Course.objects.create(department=mth, code="MTH 399", title="MTH 399", units=2, level=300, semester_term="FIRST")
    CourseOffering.objects.create(course=course, semester=calendar["current"])
    sign_in("admin.mth@uemp.test")

    rows = {r["code"]: r for r in table(api.get("/api/reports/registrations/"))}

    assert (rows["MTH 399"]["lecturer"], rows["MTH 399"]["registered"]) == ("Unallocated", 0)


def test_students_report_filters_and_carries_cgpa(graded, students, sign_in, api):
    sign_in("superadmin@uemp.test")

    everyone = table(api.get("/api/reports/students/"))
    assert [r["matric_no"] for r in everyone] == ["CSC/2024/0001", "CSC/2024/0003", "MTH/2024/0002"]
    by_matric = {r["matric_no"]: r for r in everyone}
    assert by_matric["CSC/2024/0001"]["cgpa"] == 5
    assert by_matric["MTH/2024/0002"]["cgpa"] == 0
    assert by_matric["CSC/2024/0003"]["cgpa"] is None

    program = students["mth"].program_id
    assert [r["matric_no"] for r in table(api.get(f"/api/reports/students/?program={program}"))] == ["MTH/2024/0002"]
    assert table(api.get("/api/reports/students/?level=100")) == []


def test_students_report_is_limited_to_the_admins_department(graded, students, sign_in, api):
    sign_in("admin.csc@uemp.test")

    assert [r["matric_no"] for r in table(api.get("/api/reports/students/"))] == ["CSC/2024/0001", "CSC/2024/0003"]


def test_csv_download_has_headers_rows_and_a_descriptive_filename(graded, sign_in, api):
    sign_in("admin.mth@uemp.test")

    response = api.get("/api/reports/students/?format=csv")

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert response["Content-Disposition"] == 'attachment; filename="students-mth-2026-2027-first.csv"'
    rows = csv_rows(response)
    assert rows[0] == ["Matric no", "Name", "Program", "Level", "Status", "CGPA"]
    assert rows[1] == ["MTH/2024/0002", "Ada Obi", "B.Sc. Mathematics", "300", "Active", "0.00"]
    assert len(rows) == 2


def test_csv_filename_for_a_super_admin_without_a_department(graded, calendar, sign_in, api):
    sign_in("superadmin@uemp.test")

    response = api.get(f"/api/reports/registrations/?format=csv&semester={calendar['past_first'].pk}")

    assert 'filename="registrations-all-departments-2025-2026-first.csv"' in response["Content-Disposition"]


def test_performance_csv_has_both_tables(graded, sign_in, api):
    sign_in("admin.mth@uemp.test")

    rows = csv_rows(api.get("/api/reports/performance/?format=csv"))

    assert rows[0] == ["Performance by course"]
    assert rows[1][:4] == ["Code", "Title", "Level", "Students"]
    assert rows[2][0] == "MTH 301"
    assert ["Average GPA by level"] in rows
    assert ["300", "2", "2.50"] in rows


def test_csv_cells_that_look_like_formulas_are_quoted(graded, sign_in, api):
    User.objects.filter(email="maths@uemp.test").update(first_name="=HYPERLINK(1)", last_name="x")
    sign_in("admin.mth@uemp.test")

    rows = csv_rows(api.get("/api/reports/students/?format=csv"))

    assert rows[1][1].startswith("'=HYPERLINK")


def test_unknown_format_is_refused(graded, sign_in, api):
    sign_in("admin.mth@uemp.test")

    assert api.get("/api/reports/students/?format=pdf").status_code == 400


def test_at_risk_uses_the_threshold_exclusively_and_counts_failures(students, staff, calendar, csc, sign_in, api):
    lecturer = staff["csc_lecturer"]
    first = offer("CSC 211", csc, calendar["past_first"], lecturer)
    second = offer("CSC 212", csc, calendar["past_first"], lecturer)
    # csc: D (2) + F (0) over 6 units is 1.00; late: C (3) + F (0) is exactly 1.50
    grade(enrol(students["csc"], first), 20, 25)
    grade(enrol(students["csc"], second), 10, 10)
    grade(enrol(students["late"], first), 25, 30)
    grade(enrol(students["late"], second), 10, 10)
    set_sheet(first, Sheet.APPROVED)
    set_sheet(second, Sheet.APPROVED)
    sign_in("admin.csc@uemp.test")

    rows = table(api.get("/api/reports/at-risk/"))

    assert [(r["matric_no"], r["cgpa"], r["failed_courses"]) for r in rows] == [("CSC/2024/0001", 1, 1)]


def test_at_risk_ignores_results_that_are_not_approved(students, staff, calendar, csc, sign_in, api):
    offering = offer("CSC 211", csc, calendar["past_first"], staff["csc_lecturer"])
    grade(enrol(students["csc"], offering), 5, 5)
    set_sheet(offering, Sheet.SUBMITTED)
    sign_in("admin.csc@uemp.test")

    assert table(api.get("/api/reports/at-risk/")) == []


def test_departments_report_is_for_super_admins(graded, sign_in, api):
    sign_in("admin.mth@uemp.test")
    assert api.get("/api/reports/departments/").status_code == 403
    sign_in("lecturer.mth@uemp.test")
    assert api.get("/api/reports/departments/").status_code == 403


def test_departments_report_rates_and_averages(graded, eee, sign_in, api):
    sign_in("superadmin@uemp.test")

    rows = {r["department"]: r for r in table(api.get("/api/reports/departments/"))}

    csc, mth = rows["Computer Science"], rows["Mathematics"]
    assert (csc["students"], csc["staff"], csc["courses"]) == (2, 2, 0)
    assert (csc["validation_rate"], csc["approval_rate"], csc["average_cgpa"]) == (50, None, 5)
    assert (mth["students"], mth["staff"], mth["courses"]) == (1, 2, 1)
    assert (mth["validation_rate"], mth["approval_rate"], mth["average_cgpa"]) == (100, 100, 0)
    assert rows["Electrical and Electronics Engineering"]["validation_rate"] is None


@pytest.mark.parametrize("path", ["students", "registrations", "performance", "at-risk"])
def test_reports_are_for_managers_only(graded, path, sign_in, api):
    for email in ("student@uemp.test", "lecturer.mth@uemp.test"):
        sign_in(email)
        assert api.get(f"/api/reports/{path}/").status_code == 403


def test_reports_use_a_bounded_number_of_queries(graded, sign_in, api, django_assert_max_num_queries):
    sign_in("superadmin@uemp.test")
    for path, limit in (
        ("students", 8), ("registrations", 8), ("performance", 10), ("at-risk", 10), ("departments", 14),
    ):
        with django_assert_max_num_queries(limit):
            assert api.get(f"/api/reports/{path}/").status_code == 200
