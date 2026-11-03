from datetime import datetime, timezone
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction

from apps.academics.models import Department, Program, Semester
from apps.accounts.models import StudentProfile, User
from apps.audit.models import AuditLog
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import CourseRegistration, SemesterRegistration
from apps.registrations.services import validated_registrations
from apps.results.models import ResultEntry, ResultSheet

from .conftest import make_user

pytestmark = pytest.mark.django_db

URL = "/api/student/registration/"
FORMS = "/api/registration-forms/"
WHEN = datetime(2026, 1, 10, tzinfo=timezone.utc)
FIRST, SECOND = Semester.Term.FIRST, Semester.Term.SECOND


@pytest.fixture
def student(people):
    return people[User.Role.STUDENT].student_profile


@pytest.fixture
def catalogue(csc, eee, student, calendar):
    other = Program.objects.create(department=csc, name="Data Science", award="B.Sc.", duration_years=4)

    def offer(code, level, units=3, programs=(student.program,), semester=calendar["current"], term=FIRST):
        course, _ = Course.objects.get_or_create(
            code=code,
            defaults={"department": csc, "title": code, "units": units, "level": level, "semester_term": term},
        )
        course.programs.set(programs)
        return CourseOffering.objects.create(course=course, semester=semester)

    return {
        "carry_over": offer("CSC 201", 200),
        "csc301": offer("CSC 301", 300),
        "csc303": offer("CSC 303", 300),
        "wrong_level": offer("CSC 401", 400),
        "wrong_program": offer("DSC 301", 300, programs=(other,)),
        "wrong_semester": offer("CSC 302", 300, semester=calendar["past_second"], term=SECOND),
        "past_201": offer("CSC 201", 200, semester=calendar["past_first"]),
    }


def approved_result(student, offering, grade):
    form, _ = SemesterRegistration.objects.get_or_create(
        student=student,
        semester=offering.semester,
        defaults={"status": SemesterRegistration.Status.VALIDATED, "submitted_at": WHEN},
    )
    registration = CourseRegistration.objects.create(student=student, offering=offering, semester_registration=form)
    total = Decimal(30) if grade == "F" else Decimal(55)
    ResultEntry.objects.create(
        registration=registration, ca_score=total / 2, exam_score=total / 2, total=total, grade=grade, grade_point=0
    )
    ResultSheet.objects.filter(offering=offering).update(status=ResultSheet.Status.APPROVED)
    return registration


@pytest.fixture
def failed_201(student, catalogue):
    return approved_result(student, catalogue["past_201"], "F")


def courses_by_code(response):
    return {course["code"]: course for course in response.json()["courses"]}


def submit(api, *offerings):
    return api.put(URL, {"offering_ids": [offering.pk for offering in offerings]}, format="json")


def form_of(student, semester):
    return SemesterRegistration.objects.get(student=student, semester=semester)


def test_failed_course_is_offered_as_a_preselected_carry_over(failed_201, catalogue, sign_in, api):
    sign_in("student@uemp.test")

    response = api.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert body["registration"] is None and body["registration_open"] is True and body["max_units"] == 24
    courses = courses_by_code(response)
    assert set(courses) == {"CSC 201", "CSC 301", "CSC 303"}
    assert courses["CSC 201"]["is_carry_over"] and courses["CSC 201"]["is_selected"]
    assert not courses["CSC 301"]["is_carry_over"] and not courses["CSC 301"]["is_selected"]


def test_a_carry_over_can_be_removed(failed_201, catalogue, sign_in, api):
    sign_in("student@uemp.test")

    assert submit(api, catalogue["csc301"]).status_code == 200

    courses = courses_by_code(api.get(URL))
    assert not courses["CSC 201"]["is_selected"] and courses["CSC 301"]["is_selected"]


def test_a_passed_retake_is_no_longer_a_carry_over(failed_201, student, catalogue, calendar, sign_in, api):
    retake = CourseOffering.objects.create(course=catalogue["past_201"].course, semester=calendar["past_second"])
    approved_result(student, retake, "C")
    sign_in("student@uemp.test")

    assert "CSC 201" not in courses_by_code(api.get(URL))


def test_courses_outside_level_program_or_semester_are_rejected(failed_201, catalogue, calendar, sign_in, api):
    sign_in("student@uemp.test")
    bad = [catalogue["wrong_level"], catalogue["wrong_program"], catalogue["wrong_semester"]]

    response = submit(api, catalogue["csc301"], *bad)

    assert response.status_code == 400
    errors = response.json()["offering_ids"]
    assert set(errors) == {str(offering.pk) for offering in bad}
    assert not SemesterRegistration.objects.filter(semester=calendar["current"]).exists()


def test_a_lower_level_carry_over_is_accepted(failed_201, student, catalogue, calendar, sign_in, api):
    sign_in("student@uemp.test")

    assert submit(api, catalogue["carry_over"], catalogue["csc301"]).status_code == 200

    form = form_of(student, calendar["current"])
    assert form.status == SemesterRegistration.Status.SUBMITTED
    assert set(form.course_registrations.values_list("offering__course__code", flat=True)) == {"CSC 201", "CSC 301"}


def test_twenty_four_units_pass_and_twenty_five_are_refused_per_course(student, calendar, csc, sign_in, api):
    heavy = []
    for n, units in enumerate([6, 6, 6, 6, 1]):
        course = Course.objects.create(
            department=csc, code=f"CSC 3{n}1", title="Heavy", units=units, level=300, semester_term=FIRST
        )
        course.programs.add(student.program)
        heavy.append(CourseOffering.objects.create(course=course, semester=calendar["current"]))
    sign_in("student@uemp.test")

    refused = submit(api, *heavy)
    assert refused.status_code == 400
    errors = refused.json()["offering_ids"]
    assert set(errors) == {str(offering.pk) for offering in heavy}
    assert all("25 units" in message for message in errors.values())

    assert submit(api, *heavy[:4]).status_code == 200


def test_resubmitting_replaces_the_selection_and_duplicates_are_impossible(catalogue, student, calendar, sign_in, api):
    sign_in("student@uemp.test")
    submit(api, catalogue["csc301"], catalogue["csc303"])

    assert submit(api, catalogue["csc303"]).status_code == 200
    form = form_of(student, calendar["current"])
    assert list(form.course_registrations.values_list("offering__course__code", flat=True)) == ["CSC 303"]

    twice = submit(api, catalogue["csc303"], catalogue["csc303"])
    assert twice.status_code == 400
    assert "more than once" in twice.json()["offering_ids"][str(catalogue["csc303"].pk)]
    with pytest.raises(IntegrityError), transaction.atomic():
        CourseRegistration.objects.create(student=student, offering=catalogue["csc303"], semester_registration=form)


def test_a_closed_window_refuses_changes(catalogue, calendar, sign_in, api):
    Semester.objects.filter(pk=calendar["current"].pk).update(registration_open=False)
    sign_in("student@uemp.test")

    response = submit(api, catalogue["csc301"])

    assert response.status_code == 409
    assert response.json() == {"detail": "Registration is closed."}


def test_a_validated_registration_is_locked_and_a_returned_one_reopens(catalogue, student, calendar, sign_in, api):
    sign_in("student@uemp.test")
    submit(api, catalogue["csc301"])
    form = form_of(student, calendar["current"])

    form.status = SemesterRegistration.Status.VALIDATED
    form.save()
    locked = submit(api, catalogue["csc303"])
    assert locked.status_code == 409
    assert locked.json()["detail"] == "Your registration has been validated. Contact your department to make changes."

    form.status = SemesterRegistration.Status.RETURNED
    form.return_reason = "Add CSC 303"
    form.save()
    assert submit(api, catalogue["csc301"], catalogue["csc303"]).status_code == 200
    form.refresh_from_db()
    assert form.status == SemesterRegistration.Status.SUBMITTED and form.return_reason == ""


def test_a_course_with_scores_cannot_be_dropped(catalogue, student, calendar, sign_in, api):
    sign_in("student@uemp.test")
    submit(api, catalogue["csc301"], catalogue["csc303"])
    scored = CourseRegistration.objects.get(student=student, offering=catalogue["csc301"])
    ResultEntry.objects.create(registration=scored, ca_score=Decimal(20))

    response = submit(api, catalogue["csc303"])

    assert response.status_code == 400
    assert "can't be dropped" in response.json()["offering_ids"][str(catalogue["csc301"].pk)]
    assert CourseRegistration.objects.filter(pk=scored.pk).exists()


def test_submission_is_audited_with_before_and_after(catalogue, student, calendar, sign_in, api):
    sign_in("student@uemp.test")
    submit(api, catalogue["csc301"])
    submit(api, catalogue["csc303"])

    entry = AuditLog.objects.filter(action="REGISTRATION_SUBMITTED").order_by("-created_at").first()
    assert [o["code"] for o in entry.before["offerings"]] == ["CSC 301"]
    assert [o["code"] for o in entry.after["offerings"]] == ["CSC 303"]
    assert entry.department.code == "CSC"


def test_slip_and_history(catalogue, failed_201, calendar, sign_in, api):
    sign_in("student@uemp.test")
    assert api.get(f"{URL}slip/").status_code == 404
    submit(api, catalogue["carry_over"], catalogue["csc301"])

    slip = api.get(f"{URL}slip/").json()
    assert slip["status"] == "SUBMITTED" and slip["total_units"] == 6
    assert {line["code"]: line["is_carry_over"] for line in slip["courses"]} == {"CSC 201": True, "CSC 301": False}

    history = api.get("/api/student/registrations/").json()
    assert [form["semester"]["session"]["name"] for form in history] == ["2026/2027", "2025/2026"]
    only_past = api.get(f"/api/student/registrations/?semester={calendar['past_first'].pk}").json()
    assert [form["status"] for form in only_past] == ["VALIDATED"]


@pytest.fixture
def submitted(catalogue, student, sign_in, api, calendar):
    sign_in("student@uemp.test")
    submit(api, catalogue["csc301"])
    return form_of(student, calendar["current"])


@pytest.fixture
def eee_form(eee, calendar):
    program = Program.objects.create(department=eee, name="Electrical", award="B.Eng.", duration_years=5)
    user = make_user("eee.student@uemp.test", User.Role.STUDENT, eee)
    other = StudentProfile.objects.create(user=user, matric_no="EEE/2024/0001", program=program, level=300)
    return SemesterRegistration.objects.create(student=other, semester=calendar["current"], submitted_at=WHEN)


def test_department_admin_lists_and_validates_their_department(submitted, eee_form, sign_in, api):
    sign_in("admin.csc@uemp.test")

    listing = api.get(f"{FORMS}?status=SUBMITTED&search=CSC/2024").json()
    assert [row["id"] for row in listing["results"]] == [submitted.pk]
    assert listing["results"][0]["total_units"] == 3
    assert api.get(f"{FORMS}{eee_form.pk}/").status_code == 404
    assert api.post(f"{FORMS}{eee_form.pk}/validate/").status_code == 404
    assert api.post(f"{FORMS}{eee_form.pk}/return/", {"reason": "Not yours"}, format="json").status_code == 404

    response = api.post(f"{FORMS}{submitted.pk}/validate/")
    assert response.status_code == 200
    submitted.refresh_from_db()
    assert submitted.status == "VALIDATED" and submitted.validated_by.email == "admin.csc@uemp.test"
    assert submitted.validated_at is not None
    assert AuditLog.objects.filter(action="REGISTRATION_VALIDATED").exists()
    assert api.post(f"{FORMS}{submitted.pk}/validate/").status_code == 409


def test_submitted_forms_come_first(submitted, eee_form, sign_in, api):
    SemesterRegistration.objects.filter(pk=eee_form.pk).update(status="VALIDATED")
    sign_in("superadmin@uemp.test")

    rows = api.get(FORMS).json()["results"]

    assert [row["status"] for row in rows] == ["SUBMITTED", "VALIDATED"]


def test_returning_needs_a_reason_and_is_blocked_by_scores(submitted, sign_in, api):
    sign_in("admin.csc@uemp.test")
    assert api.post(f"{FORMS}{submitted.pk}/return/", {}, format="json").status_code == 400
    too_long = api.post(f"{FORMS}{submitted.pk}/return/", {"reason": "x" * 1001}, format="json")
    assert too_long.status_code == 400
    assert too_long.json() == {"reason": ["The reason can't be longer than 1000 characters."]}

    registration = submitted.course_registrations.get()
    entry = ResultEntry.objects.create(registration=registration, exam_score=Decimal(40))
    blocked = api.post(f"{FORMS}{submitted.pk}/return/", {"reason": "Wrong course"}, format="json")
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "Scores have been entered for this registration; reopen the result sheet first."

    entry.delete()
    returned = api.post(f"{FORMS}{submitted.pk}/return/", {"reason": "Add CSC 303"}, format="json")
    assert returned.status_code == 200
    assert returned.json()["status"] == "RETURNED" and returned.json()["return_reason"] == "Add CSC 303"
    assert AuditLog.objects.filter(action="REGISTRATION_RETURNED").exists()


def test_each_role_is_kept_to_its_own_registration_endpoints(submitted, sign_in, api):
    sign_in("student@uemp.test")
    assert api.get(FORMS).status_code == 403
    assert api.post(f"{FORMS}{submitted.pk}/validate/").status_code == 403
    assert api.get("/api/registrations/").status_code == 403

    sign_in("lecturer@uemp.test")
    assert api.get(URL).status_code == 403
    assert api.put(URL, {"offering_ids": [1]}, format="json").status_code == 403


def test_course_registrations_by_offering_show_the_form_status(submitted, catalogue, sign_in, api):
    sign_in("admin.csc@uemp.test")

    rows = api.get(f"/api/registrations/?offering={catalogue['csc301'].pk}").json()["results"]

    assert [(row["student"]["matric_no"], row["form_status"]) for row in rows] == [("CSC/2024/0001", "SUBMITTED")]


def test_only_validated_registrations_reach_class_lists(submitted):
    assert not validated_registrations().exists()

    submitted.status = SemesterRegistration.Status.VALIDATED
    submitted.save()

    assert list(validated_registrations().values_list("student__matric_no", flat=True)) == ["CSC/2024/0001"]


def test_super_admin_opens_and_closes_the_window(calendar, people, sign_in, api):
    sign_in("superadmin@uemp.test")
    semester = calendar["past_first"]

    assert api.patch(f"/api/semesters/{semester.pk}/", {"registration_open": True}, format="json").json()["registration_open"]
    api.patch(f"/api/semesters/{semester.pk}/", {"registration_open": False}, format="json")

    actions = list(AuditLog.objects.filter(entity_id=str(semester.pk)).order_by("created_at").values_list("action", flat=True))
    assert actions == ["REGISTRATION_WINDOW_OPENED", "REGISTRATION_WINDOW_CLOSED"]
    sign_in("admin.csc@uemp.test")
    assert api.patch(f"/api/semesters/{semester.pk}/", {"registration_open": True}, format="json").status_code == 403



@pytest.fixture
def maths_course(csc, student, calendar):
    maths = Department.objects.create(faculty=csc.faculty, name="Mathematics", code="MTH")
    make_user("admin.mth@uemp.test", User.Role.DEPT_ADMIN, maths, staff_id="CVU/MTH/012")
    course = Course.objects.create(
        department=maths, code="MTH 301", title="Numerical Analysis", units=3, level=300, semester_term=FIRST
    )
    course.programs.add(student.program)
    return CourseOffering.objects.create(course=course, semester=calendar["current"])


def test_the_course_department_sees_every_student_on_its_course(maths_course, sign_in, api):
    sign_in("student@uemp.test")
    submit(api, maths_course)
    url = f"/api/registrations/?offering={maths_course.pk}"

    sign_in("admin.mth@uemp.test")
    rows = api.get(url).json()["results"]
    assert [(row["student"]["matric_no"], row["form_status"]) for row in rows] == [("CSC/2024/0001", "SUBMITTED")]

    sign_in("admin.csc@uemp.test")
    assert api.get(url).status_code == 404
    assert [row["student"]["matric_no"] for row in api.get(FORMS).json()["results"]] == ["CSC/2024/0001"]


def test_each_state_change_writes_exactly_one_audit_row(catalogue, student, calendar, sign_in, api):
    def rows_written(method, url, data=None):
        before = AuditLog.objects.count()
        response = getattr(api, method)(url, data, format="json")
        assert response.status_code == 200, response.content
        return AuditLog.objects.count() - before, AuditLog.objects.order_by("-pk").first().action

    sign_in("student@uemp.test")
    submitted = rows_written("put", URL, {"offering_ids": [catalogue["csc301"].pk]})
    assert submitted == (1, "REGISTRATION_SUBMITTED")
    form = form_of(student, calendar["current"])

    sign_in("admin.csc@uemp.test")
    assert rows_written("post", f"{FORMS}{form.pk}/validate/") == (1, "REGISTRATION_VALIDATED")
    assert rows_written("post", f"{FORMS}{form.pk}/return/", {"reason": "Add CSC 303"}) == (1, "REGISTRATION_RETURNED")

    sign_in("superadmin@uemp.test")
    semester = f"/api/semesters/{calendar['current'].pk}/"
    assert rows_written("patch", semester, {"registration_open": False}) == (1, "REGISTRATION_WINDOW_CLOSED")
    assert rows_written("patch", semester, {"registration_open": True}) == (1, "REGISTRATION_WINDOW_OPENED")
