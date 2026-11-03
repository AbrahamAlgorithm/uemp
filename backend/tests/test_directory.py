import pytest

from apps.accounts.models import User
from apps.courses.models import Course, CourseOffering
from apps.results.models import ResultSheet

from .conftest import enrol, grade, offer, set_sheet

pytestmark = pytest.mark.django_db


def test_levels_count_students_with_their_entry_sessions(students, sign_in, api):
    sign_in("admin.csc@uemp.test")

    levels = api.get("/api/students/levels/").json()

    assert levels == [
        {"level": 300, "student_count": 2, "entry_sessions": [{"id": levels[0]["entry_sessions"][0]["id"], "name": "2024/2025", "student_count": 2}]}
    ]


def test_levels_are_scoped_for_department_admins_and_filtered_for_super_admins(students, staff, mth, csc, sign_in, api):
    sign_in("admin.mth@uemp.test")
    assert api.get("/api/students/levels/").json()[0]["student_count"] == 1
    assert api.get(f"/api/students/levels/?department={csc.pk}").json() == []

    sign_in("superadmin@uemp.test")
    assert api.get("/api/students/levels/").json()[0]["student_count"] == 3
    assert api.get(f"/api/students/levels/?department={mth.pk}").json()[0]["student_count"] == 1


def test_levels_are_closed_to_students_and_lecturers(students, sign_in, api):
    for email in ("student@uemp.test", "lecturer@uemp.test"):
        sign_in(email)
        assert api.get("/api/students/levels/").status_code == 403


def test_student_list_filters_by_level_and_department(students, mth, sign_in, api):
    sign_in("superadmin@uemp.test")

    found = api.get(f"/api/students/?level=300&department={mth.pk}").json()["results"]

    assert [s["matric_no"] for s in found] == ["MTH/2024/0002"]
    assert found[0]["entry_session_detail"]["name"] == "2024/2025"
    assert api.get("/api/students/?level=100").json()["count"] == 0


@pytest.fixture
def record_data(students, staff, calendar, csc):
    student = students["csc"]
    first = offer("CSC 201", csc, calendar["past_first"], staff["csc_lecturer"], level=200)
    current = offer("CSC 301", csc, calendar["current"], staff["csc_lecturer"])
    grade(enrol(student, first), 10, 15)
    set_sheet(first, ResultSheet.Status.APPROVED)
    enrol(student, current, "SUBMITTED")
    return student


def test_student_record_has_registrations_results_cgpa_and_carry_overs(record_data, sign_in, api):
    sign_in("admin.csc@uemp.test")

    body = api.get(f"/api/students/{record_data.pk}/record/").json()

    assert body["student"]["matric_no"] == "CSC/2024/0001"
    assert body["cgpa"] == 0
    assert [c["code"] for c in body["carry_overs"]] == ["CSC 201"]
    first, current = body["semesters"]
    assert (first["semester"]["term"], first["registration"]["status"], first["gpa"]) == ("FIRST", "VALIDATED", "0.00")
    assert first["courses"][0]["grade"] == "F"
    assert (current["registration"]["status"], current["gpa"], current["courses"][0]["grade"]) == ("SUBMITTED", None, None)


def test_student_record_stays_inside_the_admins_department(record_data, sign_in, api):
    sign_in("admin.mth@uemp.test")
    assert api.get(f"/api/students/{record_data.pk}/record/").status_code == 404

    sign_in("superadmin@uemp.test")
    assert api.get(f"/api/students/{record_data.pk}/record/").status_code == 200

    sign_in("student@uemp.test")
    assert api.get(f"/api/students/{record_data.pk}/record/").status_code == 403


def test_student_record_only_shows_approved_grades(record_data, sign_in, api):
    ResultSheet.objects.update(status=ResultSheet.Status.SUBMITTED)
    sign_in("admin.csc@uemp.test")

    body = api.get(f"/api/students/{record_data.pk}/record/").json()

    assert body["cgpa"] is None
    assert body["carry_overs"] == []
    assert {c["grade"] for s in body["semesters"] for c in s["courses"]} == {None}


def test_staff_list_carries_current_offerings_and_total_units(mth301, staff, calendar, mth, sign_in, api):
    extra = Course.objects.create(department=mth, code="MTH 303", title="Linear Algebra", units=2, level=300, semester_term="FIRST")
    CourseOffering.objects.create(course=extra, semester=calendar["current"], lecturer=staff["mth_lecturer"].staff_profile)
    past = offer("MTH 201", mth, calendar["past_first"], staff["mth_lecturer"], level=200)
    sign_in("admin.mth@uemp.test")

    rows = api.get("/api/staff/?role=LECTURER").json()["results"]

    assert len(rows) == 1
    assert [(o["code"], o["title"], o["units"]) for o in rows[0]["current_offerings"]] == [
        ("MTH 301", "MTH 301", 3),
        ("MTH 303", "Linear Algebra", 2),
    ]
    assert rows[0]["current_offerings"][0]["id"] == mth301["offering"].pk
    assert rows[0]["total_units"] == 5
    assert rows[0]["user_id"] == staff["mth_lecturer"].pk
    assert past.pk not in {o["id"] for o in rows[0]["current_offerings"]}


def test_staff_list_filters_by_department_for_super_admins(mth301, mth, csc, sign_in, api):
    sign_in("superadmin@uemp.test")

    both = api.get("/api/staff/?role=LECTURER").json()["results"]
    only_mth = api.get(f"/api/staff/?role=LECTURER&department={mth.pk}").json()["results"]

    assert len(both) == 2
    assert [r["email"] for r in only_mth] == ["lecturer.mth@uemp.test"]
    assert api.get(f"/api/staff/?role=LECTURER&department={csc.pk}").json()["results"][0]["total_units"] == 0


def test_staff_list_query_count_does_not_grow_with_lecturers(mth301, staff, sign_in, api, django_assert_max_num_queries):
    sign_in("superadmin@uemp.test")

    with django_assert_max_num_queries(8):
        api.get("/api/staff/?role=LECTURER")


def test_offerings_filter_by_current_semester_and_unallocated(mth301, staff, calendar, mth, sign_in, api):
    open_course = Course.objects.create(department=mth, code="MTH 399", title="MTH 399", units=2, level=300, semester_term="FIRST")
    open_offering = CourseOffering.objects.create(course=open_course, semester=calendar["current"])
    old = CourseOffering.objects.create(course=open_course, semester=calendar["past_first"])
    sign_in("admin.mth@uemp.test")

    current = {o["id"] for o in api.get("/api/offerings/?semester=current").json()["results"]}
    unallocated = {o["id"] for o in api.get("/api/offerings/?semester=current&unallocated=true").json()["results"]}
    past = {o["id"] for o in api.get(f"/api/offerings/?semester={calendar['past_first'].pk}").json()["results"]}

    assert current == {mth301["offering"].pk, open_offering.pk}
    assert unallocated == {open_offering.pk}
    assert past == {old.pk}
    assert api.get("/api/offerings/?semester=soon").status_code == 400


def test_an_unallocated_offering_can_be_given_a_lecturer(mth301, staff, calendar, mth, sign_in, api):
    course = Course.objects.create(department=mth, code="MTH 399", title="MTH 399", units=2, level=300, semester_term="FIRST")
    offering = CourseOffering.objects.create(course=course, semester=calendar["current"])
    sign_in("admin.mth@uemp.test")

    response = api.patch(f"/api/offerings/{offering.pk}/", {"lecturer": staff["mth_lecturer"].staff_profile.pk}, format="json")

    assert response.status_code == 200
    assert api.get("/api/offerings/?semester=current&unallocated=true").json()["results"] == []


def test_department_administrators_are_listed_for_super_admins(staff, csc, mth, sign_in, api):
    sign_in("superadmin@uemp.test")

    admins = api.get(f"/api/departments/{mth.pk}/admins/").json()

    assert [(a["email"], a["staff_id"], a["status"]) for a in admins] == [("admin.mth@uemp.test", "CVU/MTH/012", "ACTIVE")]
    sign_in("admin.mth@uemp.test")
    assert api.get(f"/api/departments/{mth.pk}/admins/").status_code == 403


def test_super_admin_assigns_and_removes_a_department_admin_without_deleting(staff, mth, sign_in, api):
    lecturer = staff["mth_lecturer"]
    sign_in("superadmin@uemp.test")

    promoted = api.patch(f"/api/users/{lecturer.pk}/", {"role": "DEPT_ADMIN", "department": mth.pk}, format="json")
    assert promoted.status_code == 200
    assert {a["email"] for a in api.get(f"/api/departments/{mth.pk}/admins/").json()} == {
        "admin.mth@uemp.test", "lecturer.mth@uemp.test",
    }

    demoted = api.patch(f"/api/users/{lecturer.pk}/", {"role": "LECTURER", "department": mth.pk}, format="json")
    assert demoted.status_code == 200
    assert [a["email"] for a in api.get(f"/api/departments/{mth.pk}/admins/").json()] == ["admin.mth@uemp.test"]
    assert User.objects.filter(pk=lecturer.pk).exists()
    assert api.delete(f"/api/users/{lecturer.pk}/").status_code == 405


def test_a_new_student_enters_in_the_session_their_level_implies(people, calendar, csc, sign_in, api):
    program = people[User.Role.STUDENT].student_profile.program
    sign_in("admin.csc@uemp.test")
    body = {
        "first_name": "Ife", "last_name": "Ade", "email": "ife@uemp.test", "matric_no": "CSC/2025/0050",
        "program": program.pk, "level": 200, "gender": "F", "initial_password": "Demo@2026x",
    }

    created = api.post("/api/students/", body, format="json")

    assert created.status_code == 201
    assert created.json()["entry_session_detail"]["name"] == "2025/2026"


def test_managers_read_the_semester_list_but_only_super_admins_change_it(calendar, staff, sign_in, api):
    sign_in("admin.mth@uemp.test")
    assert len(api.get("/api/semesters/").json()["results"]) == 3
    assert api.patch(f"/api/semesters/{calendar['current'].pk}/", {"registration_open": False}, format="json").status_code == 403

    sign_in("lecturer.mth@uemp.test")
    assert api.get("/api/semesters/").status_code == 403
