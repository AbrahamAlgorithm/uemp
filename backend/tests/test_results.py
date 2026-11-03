from decimal import Decimal

import pytest
from django.db.models import Q

from apps.audit.models import AuditLog
from apps.registrations.models import SemesterRegistration
from apps.results.grading import cgpa, gpa, grade_for
from apps.results.models import ResultEntry, ResultSheet

from .conftest import enrol, offer

pytestmark = pytest.mark.django_db

Form = SemesterRegistration.Status
Sheet = ResultSheet.Status
FEEDBACK = "Recheck the CA for MTH/2024/0002 against the class register."


def sheet_url(offering, suffix=""):
    return f"/api/lecturer/offerings/{offering.pk}/sheet/{suffix}"


def save(api, offering, *rows):
    return api.patch(sheet_url(offering, "entries/"), {"entries": list(rows)}, format="json")


def scores(registration, **fields):
    return {"registration_id": registration.pk, **fields}


def submit(api, offering, confirm=False):
    return api.post(sheet_url(offering, "submit/"), {"confirm_incomplete": confirm}, format="json")


def review(api, sheet, verb, **body):
    return api.post(f"/api/result-sheets/{sheet.pk}/{verb}/", body, format="json")


def entry_of(registration):
    return ResultEntry.objects.get(registration=registration)


def set_status(sheet, status):
    ResultSheet.objects.filter(pk=sheet.pk).update(status=status)


def submitted(mth301, sign_in, api):
    sign_in("lecturer.mth@uemp.test")
    save(api, mth301["offering"], scores(mth301["csc"], ca_score=30, exam_score=45), scores(mth301["mth"], ca_score=20))
    assert submit(api, mth301["offering"], confirm=True).status_code == 200


def approved(mth301, sign_in, api):
    submitted(mth301, sign_in, api)
    sign_in("admin.mth@uemp.test")
    assert review(api, mth301["sheet"], "approve").status_code == 200


def result_codes(api):
    body = api.get("/api/student/results/").json()
    return [course["code"] for semester in body["semesters"] for course in semester["courses"]]


def test_lecturer_lists_their_offerings_with_scoring_progress(mth301, sign_in, api):
    ResultEntry.objects.create(registration=mth301["csc"], ca_score=30, exam_score=40)
    ResultEntry.objects.create(registration=mth301["mth"], ca_score=25)
    sign_in("lecturer.mth@uemp.test")

    rows = api.get("/api/lecturer/offerings/").json()

    assert [(r["course"]["code"], r["course"]["units"], r["sheet_status"], r["student_count"], r["scored_count"]) for r in rows] == [
        ("MTH 301", 3, "DRAFT", 2, 1)
    ]
    sign_in("lecturer@uemp.test")
    assert api.get("/api/lecturer/offerings/").json() == []


def test_another_lecturers_offering_is_not_found(mth301, sign_in, api):
    sign_in("lecturer@uemp.test")
    offering = mth301["offering"]

    assert api.get(sheet_url(offering)).status_code == 404
    assert save(api, offering, scores(mth301["csc"], ca_score=10)).status_code == 404
    assert submit(api, offering, confirm=True).status_code == 404


def test_reading_the_sheet_creates_rows_for_validated_students_only(mth301, sign_in, api):
    sign_in("lecturer.mth@uemp.test")

    body = api.get(sheet_url(mth301["offering"])).json()

    assert body["status"] == "DRAFT" and body["editable"] is True
    assert [(e["matric_no"], e["department"]["code"]) for e in body["entries"]] == [
        ("CSC/2024/0001", "CSC"),
        ("MTH/2024/0002", "MTH"),
    ]
    assert all(e["ca_score"] is None and e["exam_score"] is None and e["total"] is None for e in body["entries"])
    assert set(ResultEntry.objects.values_list("registration_id", flat=True)) == {mth301["csc"].pk, mth301["mth"].pk}


def test_partial_saves_leave_blanks_null(mth301, sign_in, api):
    sign_in("lecturer.mth@uemp.test")
    offering, csc = mth301["offering"], mth301["csc"]

    response = save(api, offering, scores(csc, ca_score=32.5), scores(mth301["mth"], ca_score=0, exam_score=60))

    assert response.status_code == 200
    entry = entry_of(csc)
    assert entry.ca_score == Decimal("32.5") and entry.exam_score is None and entry.total is None
    assert response.json()["scored_count"] == 1

    save(api, offering, scores(csc, exam_score=40))
    entry.refresh_from_db()
    assert (entry.ca_score, entry.exam_score) == (Decimal("32.5"), Decimal(40))

    save(api, offering, scores(csc, ca_score=None))
    entry.refresh_from_db()
    assert (entry.ca_score, entry.exam_score) == (None, Decimal(40))


@pytest.mark.parametrize("field, value", [("ca_score", 40.5), ("ca_score", -1), ("exam_score", 61)])
def test_scores_outside_their_range_are_refused(mth301, field, value, sign_in, api):
    sign_in("lecturer.mth@uemp.test")

    response = save(api, mth301["offering"], scores(mth301["csc"], **{field: value}))

    assert response.status_code == 400
    assert not ResultEntry.objects.filter(Q(ca_score__isnull=False) | Q(exam_score__isnull=False)).exists()


def test_students_off_the_class_list_cannot_be_scored(mth301, sign_in, api):
    sign_in("lecturer.mth@uemp.test")

    response = save(api, mth301["offering"], scores(mth301["csc"], ca_score=30), scores(mth301["late"], ca_score=20))

    assert response.status_code == 400
    assert response.json()["entries"] == {str(mth301["late"].pk): "This student isn't on the class list."}
    assert not ResultEntry.objects.filter(registration=mth301["late"]).exists()
    assert not ResultEntry.objects.filter(ca_score__isnull=False).exists()


@pytest.mark.parametrize("status", [Sheet.SUBMITTED, Sheet.APPROVED])
def test_submitted_and_approved_sheets_are_locked(mth301, status, sign_in, api):
    set_status(mth301["sheet"], status)
    sign_in("lecturer.mth@uemp.test")

    response = save(api, mth301["offering"], scores(mth301["csc"], ca_score=30))

    assert response.status_code == 409
    assert "can't be changed" in response.json()["detail"]
    assert submit(api, mth301["offering"], confirm=True).status_code == 409
    assert api.get(sheet_url(mth301["offering"])).json()["editable"] is False


def test_submitting_with_blank_scores_needs_confirmation(mth301, sign_in, api):
    sign_in("lecturer.mth@uemp.test")
    save(api, mth301["offering"], scores(mth301["csc"], ca_score=30, exam_score=45), scores(mth301["mth"], ca_score=20))

    response = submit(api, mth301["offering"])

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Blank scores will be recorded as 0.",
        "incomplete": [
            {"registration_id": mth301["mth"].pk, "matric_no": "MTH/2024/0002", "name": "Ada Obi", "missing": ["exam_score"]}
        ],
    }
    mth301["sheet"].refresh_from_db()
    assert mth301["sheet"].status == Sheet.DRAFT
    assert not AuditLog.objects.filter(action="RESULTS_SUBMITTED").exists()


def test_confirmed_submit_grades_blanks_as_zero_but_leaves_them_blank(mth301, staff, sign_in, api):
    submitted(mth301, sign_in, api)

    complete, blank = entry_of(mth301["csc"]), entry_of(mth301["mth"])
    assert (complete.total, complete.grade, complete.grade_point) == (Decimal(75), "A", Decimal(5))
    assert blank.exam_score is None
    assert (blank.total, blank.grade, blank.grade_point) == (Decimal(20), "F", Decimal(0))
    sheet = ResultSheet.objects.get(pk=mth301["sheet"].pk)
    assert sheet.status == Sheet.SUBMITTED and sheet.submitted_by == staff["mth_lecturer"] and sheet.submitted_at
    assert sheet.feedback == ""


def test_changing_the_grade_scale_after_submit_keeps_stored_grades(mth301, sign_in, api):
    sign_in("lecturer.mth@uemp.test")
    save(api, mth301["offering"], scores(mth301["csc"], ca_score=30, exam_score=35), scores(mth301["mth"], ca_score=40, exam_score=60))
    submit(api, mth301["offering"])

    sign_in("superadmin@uemp.test")
    bands = [
        {"grade": "A", "min": 60, "max": 100, "point": "4.5"},
        {"grade": "B", "min": 50, "max": 59, "point": 4},
        {"grade": "C", "min": 45, "max": 49, "point": 3},
        {"grade": "F", "min": 0, "max": 44, "point": 0},
    ]
    assert api.put("/api/grade-scale/", {"bands": bands, "confirm": True}, format="json").status_code == 200
    assert grade_for(65).grade == "A"
    sign_in("admin.mth@uemp.test")
    review(api, mth301["sheet"], "approve")

    entry = entry_of(mth301["csc"])
    assert (entry.total, entry.grade, entry.grade_point) == (Decimal(65), "B", Decimal(4))
    sign_in("student@uemp.test")
    course = api.get("/api/student/results/").json()["semesters"][0]["courses"][0]
    assert (course["grade"], course["grade_point"]) == ("B", "4.00")


def test_review_summary_counts_blanks_as_zero(mth301, sign_in, api):
    submitted(mth301, sign_in, api)
    sign_in("admin.mth@uemp.test")

    body = api.get(f"/api/result-sheets/{mth301['sheet'].pk}/").json()

    assert body["summary"] == {
        "students": 2,
        "scored": 1,
        "incomplete": 1,
        "average": "47.50",
        "highest": "75.00",
        "lowest": "20.00",
        "pass_rate": "50.00",
        "distribution": {"A": 1, "B": 0, "C": 0, "D": 0, "E": 0, "F": 1},
    }


def test_course_department_admin_approves_with_other_departments_students(mth301, staff, sign_in, api):
    submitted(mth301, sign_in, api)
    sign_in("admin.mth@uemp.test")

    listed = api.get("/api/result-sheets/").json()["results"]
    response = review(api, mth301["sheet"], "approve")

    assert [sheet["course"]["code"] for sheet in listed] == ["MTH 301"]
    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"
    assert response.json()["reviewed_by"]["id"] == staff["mth_admin"].pk
    sign_in("student@uemp.test")
    assert result_codes(api) == ["MTH 301"]


def test_another_departments_admin_cannot_find_the_sheet(mth301, sign_in, api):
    set_status(mth301["sheet"], Sheet.SUBMITTED)
    sign_in("admin.csc@uemp.test")
    sheet = mth301["sheet"]

    assert api.get("/api/result-sheets/").json()["count"] == 0
    assert api.get(f"/api/result-sheets/{sheet.pk}/").status_code == 404
    assert review(api, sheet, "approve").status_code == 404
    assert review(api, sheet, "reject", feedback=FEEDBACK).status_code == 404
    assert review(api, sheet, "reopen", reason=FEEDBACK).status_code == 404


def test_super_admin_reads_every_sheet_but_cannot_approve_or_reject(mth301, sign_in, api):
    set_status(mth301["sheet"], Sheet.SUBMITTED)
    sign_in("superadmin@uemp.test")
    sheet = mth301["sheet"]

    assert api.get(f"/api/result-sheets/{sheet.pk}/").status_code == 200
    assert review(api, sheet, "approve").status_code == 403
    assert review(api, sheet, "reject", feedback=FEEDBACK).status_code == 403
    sheet.refresh_from_db()
    assert sheet.status == Sheet.SUBMITTED


@pytest.mark.parametrize("email", ["lecturer.mth@uemp.test", "student@uemp.test"])
def test_lecturers_and_students_cannot_review(mth301, email, sign_in, api):
    set_status(mth301["sheet"], Sheet.SUBMITTED)
    sign_in(email)

    assert api.get("/api/result-sheets/").status_code == 403
    assert review(api, mth301["sheet"], "approve").status_code == 403
    assert review(api, mth301["sheet"], "reject", feedback=FEEDBACK).status_code == 403


def test_only_submitted_sheets_can_be_approved_or_rejected(mth301, sign_in, api):
    sign_in("admin.mth@uemp.test")

    approving = review(api, mth301["sheet"], "approve")

    assert approving.status_code == 409
    assert approving.json() == {"detail": "Only submitted results can be approved."}
    assert review(api, mth301["sheet"], "reject", feedback=FEEDBACK).status_code == 409


def test_rejection_needs_feedback_and_the_lecturer_can_fix_and_resubmit(mth301, sign_in, api):
    submitted(mth301, sign_in, api)
    sign_in("admin.mth@uemp.test")

    assert review(api, mth301["sheet"], "reject").status_code == 400
    assert review(api, mth301["sheet"], "reject", feedback="  ").status_code == 400
    too_long = review(api, mth301["sheet"], "reject", feedback="x" * 1001)
    assert too_long.json() == {"feedback": ["Feedback can't be longer than 1000 characters."]}
    assert review(api, mth301["sheet"], "reject", feedback=FEEDBACK).json()["status"] == "REJECTED"

    sign_in("lecturer.mth@uemp.test")
    sheet = api.get(sheet_url(mth301["offering"])).json()
    assert sheet["editable"] is True and sheet["feedback"] == FEEDBACK
    assert save(api, mth301["offering"], scores(mth301["mth"], exam_score=40)).status_code == 200
    assert entry_of(mth301["mth"]).total is None

    resubmitted = submit(api, mth301["offering"])

    assert resubmitted.status_code == 200
    body = resubmitted.json()
    assert body["status"] == "SUBMITTED" and body["feedback"] == "" and body["reviewed_by"] is None
    assert entry_of(mth301["mth"]).total == Decimal(60)


def test_reopening_needs_a_reason_and_hides_results_until_approved_again(mth301, students, sign_in, api):
    approved(mth301, sign_in, api)
    SemesterRegistration.objects.filter(student=students["late"]).update(status=Form.VALIDATED)
    sign_in("lecturer.mth@uemp.test")
    assert len(api.get(sheet_url(mth301["offering"])).json()["entries"]) == 2

    sign_in("admin.mth@uemp.test")
    assert review(api, mth301["sheet"], "reopen").status_code == 400
    too_long = review(api, mth301["sheet"], "reopen", reason="x" * 1001)
    assert too_long.json() == {"reason": ["The reason can't be longer than 1000 characters."]}
    reopened = review(api, mth301["sheet"], "reopen", reason="A script was remarked after an appeal.")
    assert reopened.status_code == 200
    assert reopened.json()["status"] == "DRAFT" and reopened.json()["feedback"] == "A script was remarked after an appeal."
    sign_in("student@uemp.test")
    assert result_codes(api) == []

    sign_in("lecturer.mth@uemp.test")
    entries = api.get(sheet_url(mth301["offering"])).json()["entries"]
    assert [entry["matric_no"] for entry in entries] == ["CSC/2024/0001", "CSC/2024/0003", "MTH/2024/0002"]
    save(api, mth301["offering"], scores(mth301["late"], ca_score=25, exam_score=30))
    assert submit(api, mth301["offering"], confirm=True).status_code == 200
    sign_in("admin.mth@uemp.test")
    assert review(api, mth301["sheet"], "approve").status_code == 200

    sign_in("student@uemp.test")
    assert result_codes(api) == ["MTH 301"]


def test_only_approved_sheets_reopen_and_super_admin_may_reopen(mth301, sign_in, api):
    sign_in("admin.mth@uemp.test")
    assert review(api, mth301["sheet"], "reopen", reason=FEEDBACK).status_code == 409

    set_status(mth301["sheet"], Sheet.APPROVED)
    sign_in("superadmin@uemp.test")
    reopened = review(api, mth301["sheet"], "reopen", reason=FEEDBACK)

    assert reopened.status_code == 200
    assert AuditLog.objects.get(action="RESULTS_REOPENED").department.code == "MTH"


def graded(student, offering, ca, exam, grade, point, status=Sheet.APPROVED):
    registration = enrol(student, offering)
    ResultEntry.objects.create(
        registration=registration, ca_score=ca, exam_score=exam, total=ca + exam, grade=grade, grade_point=point
    )
    set_status(offering.result_sheet, status)


def test_student_sees_approved_results_with_gpa_counting_both_attempts_of_a_retake(students, staff, calendar, csc, sign_in, api):
    student, lecturer = students["csc"], staff["csc_lecturer"]
    past, now = calendar["past_first"], calendar["current"]
    graded(student, offer("CSC 201", csc, past, lecturer, units=3, level=200), 15, 20, "F", 0)
    graded(student, offer("CSC 203", csc, past, lecturer, units=2, level=200), 30, 30, "B", 4)
    graded(student, offer("CSC 201", csc, now, lecturer), 25, 30, "C", 3)
    graded(student, offer("CSC 301", csc, now, lecturer, units=4), 35, 40, "A", 5)
    graded(student, offer("CSC 303", csc, now, lecturer), 20, 30, "C", 3, status=Sheet.SUBMITTED)
    sign_in("student@uemp.test")

    body = api.get("/api/student/results/").json()

    first, second = body["semesters"]
    assert [(c["code"], c["is_carry_over"]) for c in first["courses"]] == [("CSC 201", False), ("CSC 203", False)]
    assert [(c["code"], c["is_carry_over"]) for c in second["courses"]] == [("CSC 201", True), ("CSC 301", False)]
    assert (first["gpa"], second["gpa"]) == ("1.60", "4.14")
    assert body["cgpa"] == "3.08"
    assert (body["units_attempted"], body["units_passed"]) == (12, 9)
    assert body["student"]["matric_no"] == "CSC/2024/0001"
    assert (gpa(student, now), cgpa(student)) == (Decimal("4.14"), Decimal("3.08"))


def test_grade_for_puts_half_marks_in_the_band_above():
    assert grade_for(Decimal("69.5")).grade == "A"
    assert grade_for(Decimal("69.4")).grade == "B"
    assert grade_for(0).grade == "F"


def test_each_save_and_transition_writes_one_audit_row(mth301, sign_in, api):
    offering, sheet = mth301["offering"], mth301["sheet"]
    sign_in("lecturer.mth@uemp.test")
    save(api, offering, scores(mth301["csc"], ca_score=30, exam_score=40), scores(mth301["mth"], ca_score=20))
    save(api, offering, scores(mth301["csc"], ca_score=30, exam_score=45), scores(mth301["mth"], ca_score=20))
    save(api, offering, scores(mth301["csc"], ca_score="30.00"))
    submit(api, offering, confirm=True)
    sign_in("admin.mth@uemp.test")
    review(api, sheet, "reject", feedback=FEEDBACK)
    sign_in("lecturer.mth@uemp.test")
    save(api, offering, scores(mth301["mth"], exam_score=30))
    submit(api, offering)
    sign_in("admin.mth@uemp.test")
    review(api, sheet, "approve")
    review(api, sheet, "reopen", reason="A script was remarked after an appeal.")

    rows = list(AuditLog.objects.filter(entity_type="results.resultsheet", entity_id=str(sheet.pk)).order_by("pk"))

    assert [row.action for row in rows] == [
        "SCORES_SAVED",
        "SCORES_SAVED",
        "RESULTS_SUBMITTED",
        "RESULTS_REJECTED",
        "SCORES_SAVED",
        "RESULTS_SUBMITTED",
        "RESULTS_APPROVED",
        "RESULTS_REOPENED",
    ]
    assert rows[1].after["changes"] == [{"matric_no": "CSC/2024/0001", "field": "exam_score", "before": 40.0, "after": 45.0}]
    assert rows[2].after == {"status": "SUBMITTED", "count": 2, "blanks": 1}
    assert rows[3].after == {"status": "REJECTED", "feedback": FEEDBACK}
    assert {row.department.code for row in rows} == {"MTH"}


def test_submissions_list_every_sheet_with_its_timeline(mth301, staff, mth, calendar, sign_in, api):
    offer("MTH 302", mth, calendar["past_second"], staff["mth_lecturer"])
    submitted(mth301, sign_in, api)
    sign_in("admin.mth@uemp.test")
    review(api, mth301["sheet"], "reject", feedback=FEEDBACK)
    sign_in("lecturer.mth@uemp.test")

    rows = api.get("/api/lecturer/submissions/").json()

    assert [(row["course"]["code"], row["status"]) for row in rows] == [("MTH 301", "REJECTED"), ("MTH 302", "DRAFT")]
    assert rows[0]["feedback"] == FEEDBACK
    assert [(event["action"], event["note"]) for event in rows[0]["timeline"]] == [("SUBMITTED", ""), ("REJECTED", FEEDBACK)]
    assert rows[0]["timeline"][1]["actor"]["id"] == staff["mth_admin"].pk
    assert rows[1]["timeline"] == []


def test_long_feedback_reaches_the_audit_log_in_full(mth301, sign_in, api):
    submitted(mth301, sign_in, api)
    sign_in("admin.mth@uemp.test")
    feedback = "x" * 1000

    assert review(api, mth301["sheet"], "reject", feedback=feedback).status_code == 200

    assert AuditLog.objects.get(action="RESULTS_REJECTED").details == feedback
