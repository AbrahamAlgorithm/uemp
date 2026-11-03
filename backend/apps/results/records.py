from collections import defaultdict

from apps.academics.models import AcademicSession
from apps.registrations.models import CourseRegistration, SemesterRegistration
from apps.registrations.services import current_semester

from .grading import FAIL, approved_entries, weighted_average

NOT_SUBMITTED = "NOT_SUBMITTED"
CHRONOLOGICAL = ("registration__offering__semester__session__name", "registration__offering__semester__term")


def term_key(semester):
    # FIRST sorts before SECOND, the same order earlier_than() uses
    return (semester.session.name, semester.term)


def start_year(session):
    head = session.name[:4]
    return int(head) if head.isdigit() else None


def default_entry_session(level):
    """The session a student at this level entered in, when it exists."""
    semester = current_semester()
    year = start_year(semester.session) if semester else None
    if year is None:
        return None
    entered = year - (level // 100 - 1)
    return AcademicSession.objects.filter(name=f"{entered}/{entered + 1}").first()


def level_in(student, session, current_session):
    """The level a student was at in a session: one level down for each year before the current one."""
    now, then = start_year(current_session), start_year(session)
    years_back = now - then if now is not None and then is not None else 0
    return max(student.level - 100 * years_back, 100)


def points(entries):
    return [(entry.registration.offering.course.units, entry.grade_point) for entry in entries]


def course_line(course):
    return {"code": course.code, "title": course.title, "units": course.units}


def result_of(entry):
    if entry is None:
        return {"ca_score": None, "exam_score": None, "total": None, "grade": None, "grade_point": None}
    return {
        "ca_score": entry.ca_score,
        "exam_score": entry.exam_score,
        "total": entry.total,
        "grade": entry.grade,
        "grade_point": entry.grade_point,
    }


class Transcript:
    """A student's approved results, loaded once and read many ways."""

    def __init__(self, student):
        self.entries = list(
            approved_entries()
            .filter(registration__student=student)
            .select_related("registration__offering__course", "registration__offering__semester__session")
            .order_by(*CHRONOLOGICAL, "registration__offering__course__code")
        )
        self.by_registration = {entry.registration_id: entry for entry in self.entries}
        self.by_semester = defaultdict(list)
        for entry in self.entries:
            self.by_semester[entry.registration.offering.semester_id].append(entry)

    @property
    def cgpa(self):
        # a retaken course counts every attempt, so the earlier F still weighs on the average
        return weighted_average(points(self.entries))

    def gpa(self, semester_id):
        return weighted_average(points(self.by_semester.get(semester_id, [])))

    def carried_over(self, course_id, semester):
        """Whether the latest approved attempt at the course before the semester was an F."""
        grade = None
        for entry in self.entries:
            if term_key(entry.registration.offering.semester) >= term_key(semester):
                break
            if entry.registration.offering.course_id == course_id:
                grade = entry.grade
        return grade == FAIL

    def outstanding_carry_overs(self):
        latest = {entry.registration.offering.course_id: entry for entry in self.entries}
        failed = [entry.registration.offering.course for entry in latest.values() if entry.grade == FAIL]
        return [course_line(course) for course in sorted(failed, key=lambda course: course.code)]

    def failed_count(self):
        return sum(1 for entry in self.entries if entry.grade == FAIL)

    def semesters(self):
        """Each semester with approved results, oldest first, as the statement prints them."""
        rows, last_grade = [], {}
        for semester_id, entries in self.by_semester.items():
            courses = []
            for entry in entries:
                course = entry.registration.offering.course
                courses.append(
                    {
                        "registration_id": entry.registration_id,
                        **course_line(course),
                        **result_of(entry),
                        "is_carry_over": last_grade.get(course.pk) == FAIL,
                    }
                )
            for entry in entries:
                last_grade[entry.registration.offering.course_id] = entry.grade
            rows.append(
                {
                    "semester": entries[0].registration.offering.semester,
                    "courses": courses,
                    "units": sum(course["units"] for course in courses),
                    "gpa": self.gpa(semester_id),
                }
            )
        return rows


def form_status(form):
    if form is None:
        return {"status": NOT_SUBMITTED, "return_reason": "", "submitted_at": None, "validated_at": None}
    return {
        "status": form.status,
        "return_reason": form.return_reason,
        "submitted_at": form.submitted_at,
        "validated_at": form.validated_at,
    }


def semester_records(student, semesters, transcript):
    """Registration status, registered courses and their approved results for each semester."""
    forms = {form.semester_id: form for form in SemesterRegistration.objects.filter(student=student, semester__in=semesters)}
    registrations = defaultdict(list)
    lines = (
        CourseRegistration.objects.filter(semester_registration__in=list(forms.values()))
        .select_related("offering__course", "offering__lecturer__user")
        .order_by("offering__course__code")
    )
    for registration in lines:
        registrations[registration.semester_registration_id].append(registration)

    records = []
    for semester in semesters:
        form = forms.get(semester.pk)
        courses = [
            {
                "offering_id": registration.offering_id,
                **course_line(registration.offering.course),
                "lecturer": registration.offering.lecturer.user.get_full_name() if registration.offering.lecturer else None,
                "is_carry_over": transcript.carried_over(registration.offering.course_id, semester),
                **result_of(transcript.by_registration.get(registration.pk)),
            }
            for registration in (registrations[form.pk] if form else [])
        ]
        records.append(
            {
                "semester": semester,
                "registration": form_status(form),
                "courses": courses,
                "total_units": sum(course["units"] for course in courses),
                "gpa": transcript.gpa(semester.pk),
            }
        )
    return records
