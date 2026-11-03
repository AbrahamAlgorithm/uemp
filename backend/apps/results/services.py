from collections import defaultdict

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit import services as audit
from apps.audit.models import AuditLog
from apps.registrations.models import CourseRegistration
from apps.registrations.services import earlier_than, validated_registrations
from core.exceptions import Conflict

from .grading import FAIL, active_bands, grade_for, national_bands, recorded_total, replace_scale
from .models import GradeScale, ResultEntry, ResultSheet

Status = ResultSheet.Status
EDITABLE = (Status.DRAFT, Status.REJECTED)
SCORE_FIELDS = ("ca_score", "exam_score")
TIMELINE = {
    "RESULTS_SUBMITTED": "SUBMITTED",
    "RESULTS_APPROVED": "APPROVED",
    "RESULTS_REJECTED": "REJECTED",
    "RESULTS_REOPENED": "REOPENED",
}

LOCKED = {
    Status.SUBMITTED: "These results are awaiting review and can't be changed.",
    Status.APPROVED: "These results have been approved and can't be changed.",
}
NOT_ON_LIST = "This student isn't on the class list."
DUPLICATE = "This student is listed more than once."
EMPTY = "There are no students on the class list to submit."
BLANKS = "Blank scores will be recorded as 0."
SCALE_WARNING = "Changing the grading scale is not advisable. Confirm to continue."


class IncompleteScores(Exception):
    def __init__(self, entries):
        super().__init__(BLANKS)
        self.entries = entries


def is_editable(sheet):
    return sheet.status in EDITABLE


def scale():
    return list(GradeScale.objects.order_by("-min_score"))


def label(sheet):
    return f"{sheet.offering.course.code} {sheet.offering.semester}"


def score(value):
    return None if value is None else float(value)


def record(actor, action, sheet, before, after, request=None, details=""):
    return audit.record(
        actor,
        action,
        sheet,
        before={"status": before},
        after=after,
        request=request,
        target=label(sheet),
        details=details,
    )


def submitted_details(count, blanks):
    students = f"{count} {'student' if count == 1 else 'students'}"
    return f"{students}, {blanks} blank {'score' if blanks == 1 else 'scores'} recorded as 0" if blanks else students


def class_registrations(offering_id):
    return validated_registrations(CourseRegistration.objects.filter(offering_id=offering_id))


def ensure_entries(sheet):
    """Give every validated registration a score row while the sheet can still change."""
    if not is_editable(sheet):
        return
    missing = class_registrations(sheet.offering_id).filter(result__isnull=True)
    ResultEntry.objects.bulk_create([ResultEntry(registration=registration) for registration in missing], ignore_conflicts=True)


def class_list(sheet):
    return (
        ResultEntry.objects.filter(registration__in=class_registrations(sheet.offering_id))
        .select_related("registration__student__user", "registration__student__program__department")
        .order_by("registration__student__matric_no")
    )


def carry_over_students(offering, entries):
    """Students on the list whose latest approved attempt at the course before this semester was an F."""
    earlier = (
        ResultEntry.objects.filter(
            registration__student__in=[entry.registration.student_id for entry in entries],
            registration__offering__course_id=offering.course_id,
            registration__offering__result_sheet__status=Status.APPROVED,
        )
        .filter(earlier_than(offering.semester, "registration__offering__semester__"))
        .order_by("registration__offering__semester__session__name", "registration__offering__semester__term")
        .values_list("registration__student_id", "grade")
    )
    return {student_id for student_id, grade in dict(earlier).items() if grade == FAIL}


def class_counts(offering_ids):
    rows = (
        validated_registrations(CourseRegistration.objects.filter(offering_id__in=offering_ids))
        .values("offering_id")
        .annotate(
            validated=Count("id"),
            entries=Count("result"),
            scored=Count("result", filter=Q(result__ca_score__isnull=False, result__exam_score__isnull=False)),
        )
    )
    return {row["offering_id"]: row for row in rows}


def student_count(sheet, counts):
    row = counts.get(sheet.offering_id, {})
    # a locked sheet keeps the students it was submitted with; later ones join when it reopens
    return row.get("validated" if is_editable(sheet) else "entries", 0)


def timelines(sheets):
    rows = (
        AuditLog.objects.filter(
            entity_type=ResultSheet._meta.label_lower,
            entity_id__in=[str(sheet.pk) for sheet in sheets],
            action__in=TIMELINE,
        )
        .select_related("actor")
        .order_by("created_at", "pk")
    )
    events = defaultdict(list)
    for row in rows:
        after = row.after or {}
        events[int(row.entity_id)].append(
            {
                "action": TIMELINE[row.action],
                "at": row.created_at,
                "actor": {"id": row.actor.pk, "name": row.actor.get_full_name() or row.actor.email} if row.actor else None,
                "note": after.get("feedback") or after.get("reason") or "",
            }
        )
    return events


def lock_sheet(sheet):
    return (
        ResultSheet.objects.select_for_update(of=("self",))
        .select_related("offering__course__department", "offering__semester__session")
        .get(pk=sheet.pk)
    )


@transaction.atomic
def save_scores(sheet, rows, actor, request=None, source=None):
    """Save score changes, from the grid or, with source set to its filename, from an imported file."""
    sheet = lock_sheet(sheet)
    if not is_editable(sheet):
        raise Conflict(LOCKED[sheet.status])
    ensure_entries(sheet)
    entries = {entry.registration_id: entry for entry in class_list(sheet)}

    errors, seen = {}, set()
    for row in rows:
        registration_id = row["registration_id"]
        if registration_id in seen:
            errors[str(registration_id)] = DUPLICATE
        elif registration_id not in entries:
            errors[str(registration_id)] = NOT_ON_LIST
        seen.add(registration_id)
    if errors:
        raise ValidationError({"entries": errors})

    now = timezone.now()
    changes, changed = [], {}
    for row in rows:
        entry = entries[row["registration_id"]]
        for field in SCORE_FIELDS:
            if field not in row or getattr(entry, field) == row[field]:
                continue
            changes.append(
                {
                    "matric_no": entry.registration.student.matric_no,
                    "field": field,
                    "before": score(getattr(entry, field)),
                    "after": score(row[field]),
                }
            )
            setattr(entry, field, row[field])
            # the grade from an earlier submission no longer matches, submit works it out again
            entry.total = entry.grade = entry.grade_point = None
            entry.updated_at = now
            changed[entry.pk] = entry
    if not changes:
        return sheet

    ResultEntry.objects.bulk_update(changed.values(), [*SCORE_FIELDS, "total", "grade", "grade_point", "updated_at"])
    details = f"{len(changes)} {'score' if len(changes) == 1 else 'scores'} changed"
    if source is None:
        record(actor, "SCORES_SAVED", sheet, sheet.status, {"status": sheet.status, "changes": changes}, request, details)
    else:
        after = {"status": sheet.status, "file": source, "changes": changes}
        record(actor, "RESULTS_IMPORTED", sheet, sheet.status, after, request, f"{details} from {source}")
    return sheet


@transaction.atomic
def submit_sheet(sheet, actor, confirm_incomplete=False, request=None):
    sheet = lock_sheet(sheet)
    if not is_editable(sheet):
        raise Conflict(LOCKED[sheet.status])
    ensure_entries(sheet)
    entries = list(class_list(sheet))
    if not entries:
        raise Conflict(EMPTY)
    blanks = [entry for entry in entries if entry.ca_score is None or entry.exam_score is None]
    if blanks and not confirm_incomplete:
        raise IncompleteScores(blanks)

    bands = scale()
    now = timezone.now()
    for entry in entries:
        # the scores themselves stay blank; only the recorded total treats them as 0
        entry.total = recorded_total(entry)
        band = grade_for(entry.total, bands)
        entry.grade, entry.grade_point = band.grade, band.point
        entry.updated_at = now
    ResultEntry.objects.bulk_update(entries, ["total", "grade", "grade_point", "updated_at"])

    before = sheet.status
    sheet.status = Status.SUBMITTED
    sheet.submitted_by = actor
    sheet.submitted_at = now
    sheet.reviewed_by = sheet.reviewed_at = None
    sheet.feedback = ""
    sheet.save(update_fields=["status", "submitted_by", "submitted_at", "reviewed_by", "reviewed_at", "feedback", "updated_at"])
    record(
        actor,
        "RESULTS_SUBMITTED",
        sheet,
        before,
        {"status": sheet.status, "count": len(entries), "blanks": len(blanks)},
        request=request,
        details=submitted_details(len(entries), len(blanks)),
    )
    return sheet


def _review(sheet, actor, status, action, request, feedback=""):
    sheet = lock_sheet(sheet)
    if sheet.status != Status.SUBMITTED:
        verb = "approved" if status == Status.APPROVED else "rejected"
        raise Conflict(f"Only submitted results can be {verb}.")
    sheet.status = status
    sheet.reviewed_by = actor
    sheet.reviewed_at = timezone.now()
    sheet.feedback = feedback
    sheet.save(update_fields=["status", "reviewed_by", "reviewed_at", "feedback", "updated_at"])
    after = {"status": status, "feedback": feedback} if feedback else {"status": status}
    record(actor, action, sheet, Status.SUBMITTED, after, request=request, details=feedback)
    return sheet


@transaction.atomic
def approve_sheet(sheet, actor, request=None):
    return _review(sheet, actor, Status.APPROVED, "RESULTS_APPROVED", request)


@transaction.atomic
def reject_sheet(sheet, actor, feedback, request=None):
    return _review(sheet, actor, Status.REJECTED, "RESULTS_REJECTED", request, feedback=feedback)


@transaction.atomic
def reopen_sheet(sheet, actor, reason, request=None):
    sheet = lock_sheet(sheet)
    if sheet.status != Status.APPROVED:
        raise Conflict("Only approved results can be reopened.")
    sheet.status = Status.DRAFT
    # the lecturer reads the reason in the feedback banner until they resubmit
    sheet.feedback = reason
    sheet.submitted_by = sheet.submitted_at = sheet.reviewed_by = sheet.reviewed_at = None
    sheet.save(update_fields=["status", "feedback", "submitted_by", "submitted_at", "reviewed_by", "reviewed_at", "updated_at"])
    ensure_entries(sheet)
    record(
        actor,
        "RESULTS_REOPENED",
        sheet,
        Status.APPROVED,
        {"status": sheet.status, "reason": reason},
        request=request,
        details=reason,
    )
    return sheet


def scale_snapshot():
    return [{**band, "point": score(band["point"])} for band in active_bands()]


@transaction.atomic
def update_scale(bands, actor, request=None, action="GRADE_SCALE_UPDATED"):
    # two saves at once would otherwise both insert and leave overlapping bands
    list(GradeScale.objects.select_for_update())
    before = scale_snapshot()
    replace_scale(bands)
    after = scale_snapshot()
    audit.record(
        actor,
        action,
        GradeScale,
        before={"bands": before},
        after={"bands": after},
        request=request,
        target="Grading scale",
        details=", ".join(f"{band['grade']} {band['min']}-{band['max']} ({band['point']:g})" for band in after),
    )


def reset_scale(actor, request=None):
    update_scale(national_bands(), actor, request, action="GRADE_SCALE_RESET")
