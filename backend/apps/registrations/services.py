from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.academics.models import Semester
from apps.accounts.models import StudentProfile
from apps.audit import services as audit
from apps.courses.models import CourseOffering
from apps.results.models import ResultEntry, ResultSheet
from core.exceptions import Conflict

from .models import CourseRegistration, SemesterRegistration

FAIL = "F"

CLOSED = "Registration is closed."
LOCKED = "Your registration has been validated. Contact your department to make changes."
SCORED_RETURN = "Scores have been entered for this registration; reopen the result sheet first."
NOT_OFFERED = "This course isn't open to you this semester."
DUPLICATE = "This course is listed more than once."
SCORED_DROP = "Scores have been entered for this course, so it can't be dropped."
OVER_LIMIT = "These courses add up to {total} units, over the {limit}-unit limit."


def current_semester():
    return Semester.objects.select_related("session").filter(is_current=True).first()


def earlier_than(semester, prefix=""):
    # FIRST sorts before SECOND, so session name then term is calendar order
    return Q(**{f"{prefix}session__name__lt": semester.session.name}) | Q(
        **{f"{prefix}session__name": semester.session.name, f"{prefix}term__lt": semester.term}
    )


def latest_grades(student, semester):
    """Each course's grade in the student's most recent approved result before the semester."""
    entries = (
        ResultEntry.objects.filter(
            registration__student=student,
            registration__offering__result_sheet__status=ResultSheet.Status.APPROVED,
        )
        .filter(earlier_than(semester, "registration__offering__semester__"))
        .order_by("registration__offering__semester__session__name", "registration__offering__semester__term")
        .values_list("registration__offering__course_id", "grade")
    )
    # later results overwrite earlier ones, which is what a retake does
    return dict(entries)


def carry_over_course_ids(student, semester):
    return {course_id for course_id, grade in latest_grades(student, semester).items() if grade == FAIL}


def registration_options(student, semester):
    """(offering, is_carry_over) pairs the student may register for in the semester."""
    grades = latest_grades(student, semester)
    carry_overs = {course_id for course_id, grade in grades.items() if grade == FAIL}
    passed = {course_id for course_id, grade in grades.items() if grade != FAIL}
    offerings = (
        CourseOffering.objects.filter(semester=semester)
        .filter(Q(course__in=carry_overs) | Q(course__level=student.level, course__programs=student.program))
        .exclude(course__in=passed)
        .select_related("course", "lecturer__user")
        .distinct()
        .order_by("course__code")
    )
    return [(offering, offering.course_id in carry_overs) for offering in offerings]


def validated_registrations(queryset=None):
    """Registrations that belong on lecturer class lists and result sheets."""
    queryset = CourseRegistration.objects.all() if queryset is None else queryset
    return queryset.filter(semester_registration__status=SemesterRegistration.Status.VALIDATED)


def scored(registrations):
    return ResultEntry.objects.filter(registration__in=registrations).filter(
        Q(ca_score__isnull=False) | Q(exam_score__isnull=False)
    )


def offering_summary(offerings):
    return [{"id": offering.pk, "code": offering.course.code} for offering in sorted(offerings, key=lambda o: o.course.code)]


@transaction.atomic
def submit_registration(student, offering_ids, actor, request=None):
    """Replace the student's selection for the current semester and mark it SUBMITTED."""
    # one submission at a time per student, so two tabs can't interleave their changes
    StudentProfile.objects.select_for_update().filter(pk=student.pk).first()
    semester = current_semester()
    if semester is None or not semester.registration_open:
        raise Conflict(CLOSED)
    form = SemesterRegistration.objects.filter(student=student, semester=semester).first()
    if form is not None and form.status == SemesterRegistration.Status.VALIDATED:
        raise Conflict(LOCKED)

    options = {offering.pk: offering for offering, _ in registration_options(student, semester)}
    errors = {}
    chosen = []
    for offering_id in offering_ids:
        if offering_id in chosen:
            errors[str(offering_id)] = DUPLICATE
        elif offering_id not in options:
            errors[str(offering_id)] = NOT_OFFERED
        else:
            chosen.append(offering_id)
    total = sum(options[offering_id].course.units for offering_id in chosen)
    limit = settings.MAX_UNITS_PER_SEMESTER
    if total > limit:
        for offering_id in chosen:
            errors.setdefault(str(offering_id), OVER_LIMIT.format(total=total, limit=limit))

    current = {
        registration.offering_id: registration
        for registration in (
            form.course_registrations.select_related("offering__course") if form is not None else []
        )
    }
    dropped = [registration for offering_id, registration in current.items() if offering_id not in chosen]
    for offering_id in scored(dropped).values_list("registration__offering_id", flat=True):
        errors[str(offering_id)] = SCORED_DROP
    if errors:
        raise ValidationError({"offering_ids": errors})

    before = offering_summary(registration.offering for registration in current.values())
    if form is None:
        form = SemesterRegistration(student=student, semester=semester)
    form.status = SemesterRegistration.Status.SUBMITTED
    form.submitted_at = timezone.now()
    form.return_reason = ""
    form.validated_by = None
    form.validated_at = None
    form.save()

    # a dropped course can still have an empty score row; scored ones were refused above
    ResultEntry.objects.filter(registration__in=dropped).delete()
    CourseRegistration.objects.filter(pk__in=[registration.pk for registration in dropped]).delete()
    for offering_id in chosen:
        if offering_id not in current:
            CourseRegistration.objects.create(student=student, offering=options[offering_id], semester_registration=form)

    after = offering_summary(options[offering_id] for offering_id in chosen)
    audit.record(
        actor,
        "REGISTRATION_SUBMITTED",
        form,
        before={"offerings": before},
        after={"offerings": after},
        request=request,
        target=f"{student.matric_no} {semester}",
        details=f"{len(chosen)} courses, {total} units",
    )
    return form


def _locked(form):
    return SemesterRegistration.objects.select_for_update().select_related("student", "semester__session").get(pk=form.pk)


@transaction.atomic
def validate_registration(form, actor, request=None):
    form = _locked(form)
    if form.status != SemesterRegistration.Status.SUBMITTED:
        raise Conflict("Only a submitted registration can be validated.")
    form.status = SemesterRegistration.Status.VALIDATED
    form.validated_by = actor
    form.validated_at = timezone.now()
    form.save(update_fields=["status", "validated_by", "validated_at", "updated_at"])
    audit.record(
        actor,
        "REGISTRATION_VALIDATED",
        form,
        before={"status": SemesterRegistration.Status.SUBMITTED},
        after={"status": form.status},
        request=request,
        target=f"{form.student.matric_no} {form.semester}",
    )
    return form


@transaction.atomic
def return_registration(form, actor, reason, request=None):
    form = _locked(form)
    if form.status == SemesterRegistration.Status.RETURNED:
        raise Conflict("This registration has already been returned.")
    if scored(form.course_registrations.all()).exists():
        raise Conflict(SCORED_RETURN)
    before = form.status
    form.status = SemesterRegistration.Status.RETURNED
    form.return_reason = reason
    form.validated_by = None
    form.validated_at = None
    form.save(update_fields=["status", "return_reason", "validated_by", "validated_at", "updated_at"])
    audit.record(
        actor,
        "REGISTRATION_RETURNED",
        form,
        before={"status": before},
        after={"status": form.status, "reason": reason},
        request=request,
        target=f"{form.student.matric_no} {form.semester}",
        details=reason,
    )
    return form
