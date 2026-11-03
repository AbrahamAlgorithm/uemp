import os
import random
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import ProtectedError, Q

from apps.academics.models import AcademicSession, Department, Faculty, Program, Semester
from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.audit.models import AuditLog
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import CourseRegistration, SemesterRegistration
from apps.registrations.services import validated_registrations
from apps.results import services as results
from apps.results.grading import NATIONAL_GRADE_SCALE, grade_for, national_bands, replace_scale
from apps.results.models import GradeScale, ResultEntry, ResultSheet

DOMAIN = "uemp.test"
DEFAULT_PASSWORD = "Demo@2026"

FIRST, SECOND = Semester.Term.FIRST, Semester.Term.SECOND
Status = ResultSheet.Status
Form = SemesterRegistration.Status

FACULTIES = [
    ("SCI", "Faculty of Science"),
    ("ENG", "Faculty of Engineering"),
]

DEPARTMENTS = [
    ("CSC", "Computer Science", "SCI"),
    ("MTH", "Mathematics", "SCI"),
    ("EEE", "Electrical and Electronics Engineering", "ENG"),
]

PROGRAMS = [
    ("CS", "CSC", "Computer Science", "B.Sc.", 4),
    ("IT", "CSC", "Information Technology", "B.Sc.", 4),
    ("MTH", "MTH", "Mathematics", "B.Sc.", 4),
    ("EEE", "EEE", "Electrical and Electronics Engineering", "B.Eng.", 5),
]

PAST_SESSION = "2025/2026"
CURRENT_SESSION = "2026/2027"
PAST_FIRST = (PAST_SESSION, FIRST)
PAST_SECOND = (PAST_SESSION, SECOND)
CURRENT = (CURRENT_SESSION, FIRST)

# the older sessions only exist as entry sessions, so they have no semesters
SESSIONS = [
    ("2022/2023", date(2022, 10, 3), date(2023, 8, 25)),
    ("2023/2024", date(2023, 10, 2), date(2024, 8, 30)),
    ("2024/2025", date(2024, 10, 7), date(2025, 8, 29)),
    (PAST_SESSION, date(2025, 10, 6), date(2026, 8, 28)),
    (CURRENT_SESSION, date(2026, 10, 5), date(2027, 8, 27)),
]

SUPER_ADMIN = ("superadmin", "CVU/REG/010", "Mr.", "Tunde", "Bakare")

DEPT_ADMINS = [
    ("admin.csc", "CVU/CSC/017", "Mrs.", "Bisi", "Adewale"),
    ("admin.mth", "CVU/MTH/012", "Mr.", "Kunle", "Ojo"),
    ("admin.eee", "CVU/EEE/015", "Mrs.", "Grace", "Effiong"),
]

LECTURERS = [
    ("lecturer1.csc", "CVU/CSC/073", "Dr.", "Adebayo", "Ogunleye"),
    ("lecturer2.csc", "CVU/CSC/041", "Prof.", "Ngozi", "Eze"),
    ("lecturer3.csc", "CVU/CSC/088", "Dr.", "Ibrahim", "Musa"),
    ("lecturer1.mth", "CVU/MTH/052", "Dr.", "Aisha", "Bello"),
    ("lecturer2.mth", "CVU/MTH/029", "Prof.", "Olumide", "Akinola"),
    ("lecturer1.eee", "CVU/EEE/064", "Engr.", "Chukwudi", "Obi"),
    ("lecturer2.eee", "CVU/EEE/037", "Dr.", "Halima", "Yusuf"),
]

STUDENTS = [
    # student1 is the 300-level CSC student with results in both semesters
    ("CS", 300, "Chiamaka", "Okafor", "F", "2006-04-12", 0.82),
    ("CS", 300, "Ifeanyi", "Okonkwo", "M", "2005-11-03", 0.64),
    ("CS", 300, "Temitope", "Alabi", "F", "2006-01-27", 0.74),
    ("IT", 300, "Yusuf", "Danjuma", "M", "2005-08-19", 0.5),
    ("CS", 100, "Tobiloba", "Adeyemi", "M", "2008-02-09", 0.7),
    ("CS", 100, "Zainab", "Abdullahi", "F", "2008-06-30", 0.86),
    ("IT", 100, "Chukwuemeka", "Nnamdi", "M", "2007-12-15", 0.55),
    ("CS", 100, "Amarachi", "Uche", "F", "2008-09-04", 0.62),
    ("MTH", 100, "Folasade", "Ajayi", "F", "2008-03-21", 0.68),
    ("MTH", 200, "Babatunde", "Olawale", "M", "2007-05-17", 0.47),
    ("MTH", 200, "Ngozi", "Chukwu", "F", "2007-10-08", 0.78),
    ("MTH", 300, "Damilola", "Oyelaran", "F", "2006-07-02", 0.66),
    ("MTH", 400, "Musa", "Garba", "M", "2005-01-14", 0.58),
    ("MTH", 400, "Hauwa", "Ibrahim", "F", "2004-12-29", 0.88),
    ("EEE", 200, "Emeka", "Eze", "M", "2007-04-25", 0.6),
    # nothing is offered to 300-level EEE, so this student has not registered yet
    ("EEE", 300, "Segun", "Afolabi", "M", "2006-02-18", 0.7),
    ("EEE", 400, "Rukayat", "Lawal", "F", "2005-06-11", 0.76),
    ("EEE", 400, "Kehinde", "Ogunbiyi", "M", "2004-09-23", 0.44),
    ("EEE", 500, "Blessing", "Etim", "F", "2004-03-07", 0.8),
    ("EEE", 500, "Abubakar", "Sani", "M", "2003-11-30", 0.56),
]

ADDRESSES = [
    "14 Adebayo Street, Bodija, Ibadan",
    "7 Ring Road, Challenge, Ibadan",
    "22 Awolowo Avenue, Old Bodija, Ibadan",
    "3 Oluyole Estate Road, Ibadan",
    "45 Agodi GRA, Ibadan",
    "11 Akobo Road, Ibadan",
]

# the first digit of the code is the level and an odd last digit means first semester
COURSES = [
    ("CSC 101", "Introduction to Computer Science", 3, ["CS", "IT"]),
    ("CSC 201", "Computer Programming I", 3, ["CS", "IT"]),
    ("CSC 202", "Computer Programming II", 3, ["CS", "IT"]),
    ("CSC 204", "Fundamentals of Data Structures", 3, ["CS", "IT"]),
    ("CSC 301", "Data Structures and Algorithms", 3, ["CS", "IT"]),
    ("CSC 303", "Operating Systems", 3, ["CS", "IT"]),
    ("CSC 305", "Database Management Systems", 3, ["CS", "IT"]),
    ("CSC 307", "Computer Architecture", 3, ["CS"]),
    ("CSC 309", "Software Engineering", 3, ["CS", "IT"]),
    ("CSC 311", "Object-Oriented Programming", 3, ["CS", "IT"]),
    ("CSC 315", "Computer Networks", 3, ["CS", "IT"]),
    ("MTH 101", "Elementary Mathematics I", 3, ["MTH"]),
    ("MTH 102", "Elementary Mathematics II", 3, ["MTH"]),
    ("MTH 201", "Mathematical Methods I", 3, ["MTH"]),
    ("MTH 301", "Numerical Analysis", 3, ["CS", "MTH"]),
    ("MTH 302", "Complex Analysis I", 2, ["MTH"]),
    ("MTH 401", "Functional Analysis", 3, ["MTH"]),
    ("EEE 201", "Circuit Theory I", 3, ["EEE"]),
    ("EEE 302", "Electromagnetic Fields", 2, ["EEE"]),
    ("EEE 401", "Power Systems I", 3, ["EEE"]),
    ("EEE 402", "Control Systems", 3, ["EEE"]),
    ("EEE 501", "Power Electronics", 3, ["EEE"]),
]

OFFERINGS = {
    PAST_FIRST: {
        "CSC 201": ("lecturer3.csc", Status.APPROVED, "full"),
        "MTH 101": ("lecturer2.mth", Status.APPROVED, "full"),
        "MTH 201": ("lecturer1.mth", Status.APPROVED, "full"),
        "MTH 301": ("lecturer1.mth", Status.APPROVED, "full"),
        "EEE 201": ("lecturer1.eee", Status.APPROVED, "full"),
        "EEE 401": ("lecturer2.eee", Status.APPROVED, "full"),
    },
    PAST_SECOND: {
        "CSC 202": ("lecturer1.csc", Status.APPROVED, "full"),
        "CSC 204": ("lecturer2.csc", Status.APPROVED, "full"),
        "MTH 102": ("lecturer2.mth", Status.APPROVED, "full"),
        "MTH 302": ("lecturer1.mth", Status.APPROVED, "full"),
        "EEE 302": ("lecturer2.eee", Status.APPROVED, "full"),
        "EEE 402": ("lecturer1.eee", Status.APPROVED, "full"),
    },
    CURRENT: {
        "CSC 101": ("lecturer3.csc", Status.DRAFT, "partial"),
        "CSC 201": ("lecturer3.csc", Status.DRAFT, None),
        "CSC 301": ("lecturer1.csc", Status.REJECTED, "full"),
        "CSC 303": ("lecturer2.csc", Status.SUBMITTED, "full"),
        # enough 300-level options that a full selection runs past the unit cap
        "CSC 305": ("lecturer2.csc", Status.DRAFT, None),
        "CSC 307": ("lecturer3.csc", Status.DRAFT, None),
        "CSC 309": ("lecturer1.csc", Status.DRAFT, None),
        "CSC 311": ("lecturer2.csc", Status.DRAFT, None),
        "CSC 315": ("lecturer3.csc", Status.DRAFT, None),
        "MTH 101": ("lecturer2.mth", Status.DRAFT, None),
        "MTH 201": ("lecturer1.mth", Status.SUBMITTED, "full"),
        "MTH 301": ("lecturer1.mth", Status.APPROVED, "full"),
        "MTH 401": ("lecturer2.mth", Status.APPROVED, "full"),
        "EEE 201": ("lecturer1.eee", Status.DRAFT, "partial"),
        "EEE 401": ("lecturer2.eee", Status.REJECTED, "full"),
        "EEE 501": ("lecturer1.eee", Status.DRAFT, None),
    },
}

# student1 failed CSC 201, so it comes back this semester as a pre-selected carry-over
FORCED_SCORES = {(1, PAST_FIRST, "CSC 201"): (Decimal(11), Decimal(17))}

# this semester's forms by student number; everyone else is validated
CURRENT_FORMS = {
    1: None,
    3: (Form.RETURNED, "Please confirm your electives with your course adviser, then submit again."),
    8: (Form.SUBMITTED, ""),
}

REGISTERED_FROM = {
    PAST_FIRST: datetime(2025, 10, 13, 9, 0, tzinfo=timezone.utc),
    PAST_SECOND: datetime(2026, 2, 23, 9, 0, tzinfo=timezone.utc),
    CURRENT: datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc),
}

FEEDBACK = {
    "CSC 301": "Check CA scores for two students",
    "EEE 401": "Two exam scores don't match the marked scripts",
}

SUBMITTED_FROM = {
    PAST_FIRST: datetime(2026, 2, 9, 9, 0, tzinfo=timezone.utc),
    PAST_SECOND: datetime(2026, 7, 13, 9, 0, tzinfo=timezone.utc),
    CURRENT: datetime(2026, 10, 26, 9, 0, tzinfo=timezone.utc),
}


def office_hours(start, n):
    # monday to wednesday, 9am to 4pm, so a review two days later still lands on a weekday
    return start + timedelta(days=n % 3, hours=n % 7, minutes=n * 17 % 60)


def demo_scores(ability, matric_no, course_code):
    # seeded so a rerun produces the same scores
    rng = random.Random(f"{matric_no} {course_code}")
    ca = round(40 * min(1, ability + rng.uniform(-0.15, 0.1)))
    exam = round(60 * min(1, ability + rng.uniform(-0.2, 0.1)))
    return Decimal(ca), Decimal(exam)


class Command(BaseCommand):
    help = "Create demo data for local development. Safe to run more than once."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete the demo data before seeding.")

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self.reset()
        # one hash for every account: they share a published password and argon2 is slow
        self.password = make_password(os.environ.get("SEED_PASSWORD", DEFAULT_PASSWORD))
        self.logins = []
        self.seed_grade_scale()
        self.seed_structure()
        self.seed_calendar()
        self.seed_staff()
        self.seed_students()
        self.seed_courses()
        self.seed_registrations()
        self.seed_results()
        self.print_logins()

    def reset(self):
        departments = Department.objects.filter(code__in=[code for code, _, _ in DEPARTMENTS])
        sessions = AcademicSession.objects.filter(name__in=[name for name, _, _ in SESSIONS])
        offerings = CourseOffering.objects.filter(
            Q(course__department__in=departments) | Q(semester__session__in=sessions)
        )
        sheets = ResultSheet.objects.filter(offering__in=offerings)
        try:
            AuditLog.objects.filter(
                entity_type=ResultSheet._meta.label_lower, entity_id__in=[str(pk) for pk in sheets.values_list("pk", flat=True)]
            ).delete()
            ResultEntry.objects.filter(registration__offering__in=offerings).delete()
            CourseRegistration.objects.filter(offering__in=offerings).delete()
            SemesterRegistration.objects.filter(
                Q(semester__session__in=sessions) | Q(student__user__email__endswith=f"@{DOMAIN}")
            ).delete()
            sheets.delete()
            offerings.delete()
            Course.objects.filter(department__in=departments).delete()
            User.objects.filter(email__endswith=f"@{DOMAIN}").delete()
            Semester.objects.filter(session__in=sessions).delete()
            sessions.delete()
            Program.objects.filter(department__in=departments).delete()
            departments.delete()
            Faculty.objects.filter(code__in=[code for code, _ in FACULTIES]).delete()
            GradeScale.objects.filter(grade__in=[grade for _, _, grade, _ in NATIONAL_GRADE_SCALE]).delete()
        except ProtectedError as error:
            raise CommandError(error.args[0]) from error

    def seed_grade_scale(self):
        replace_scale(national_bands())
        self.bands = list(GradeScale.objects.order_by("-min_score"))

    def seed_structure(self):
        faculties = {}
        for code, name in FACULTIES:
            faculties[code], _ = Faculty.objects.update_or_create(code=code, defaults={"name": name})

        self.departments = {}
        for code, name, faculty in DEPARTMENTS:
            self.departments[code], _ = Department.objects.update_or_create(
                code=code,
                defaults={"name": name, "faculty": faculties[faculty]},
            )

        self.programs = {}
        for key, department, name, award, years in PROGRAMS:
            self.programs[key], _ = Program.objects.update_or_create(
                department=self.departments[department],
                name=name,
                defaults={"award": award, "duration_years": years},
            )

    def seed_calendar(self):
        self.sessions = sessions = {}
        for name, start, end in SESSIONS:
            sessions[name], _ = AcademicSession.objects.update_or_create(
                name=name,
                defaults={"start_date": start, "end_date": end},
            )
        # the partial unique index allows only one current semester at a time
        Semester.objects.filter(is_current=True).exclude(session=sessions[CURRENT_SESSION], term=FIRST).update(
            is_current=False
        )
        self.semesters = {}
        for key in OFFERINGS:
            session, term = key
            self.semesters[key], _ = Semester.objects.update_or_create(
                session=sessions[session],
                term=term,
                defaults={"is_current": key == CURRENT, "registration_open": key == CURRENT},
            )

    def make_user(self, handle, identifier, first_name, last_name, role, department=None):
        # demo passwords are public, so none of these accounts may reach the django admin
        user, _ = User.objects.update_or_create(
            email=f"{handle}@{DOMAIN}",
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
                "department": department,
                "status": User.Status.ACTIVE,
                "is_staff": False,
                "is_superuser": False,
                "password": self.password,
            },
        )
        self.logins.append((user, identifier))
        return user

    def make_staff(self, row, role):
        handle, staff_id, title, first_name, last_name = row
        code = staff_id.split("/")[1]
        department = self.departments.get(code)
        user = self.make_user(handle, staff_id, first_name, last_name, role, department)
        profile, _ = StaffProfile.objects.update_or_create(
            user=user,
            defaults={"staff_id": staff_id, "title": title, "phone": f"0803 450 {len(self.logins):04d}"},
        )
        return profile

    def seed_staff(self):
        self.make_staff(SUPER_ADMIN, User.Role.SUPER_ADMIN)
        self.dept_admins = {}
        for row in DEPT_ADMINS:
            profile = self.make_staff(row, User.Role.DEPT_ADMIN)
            self.dept_admins[profile.user.department.code] = profile.user
        self.lecturers = {row[0]: self.make_staff(row, User.Role.LECTURER) for row in LECTURERS}

    def seed_students(self):
        current_year = int(CURRENT_SESSION[:4])
        self.students = []
        self.ability = {}
        self.number = {}
        for n, (program_key, level, first_name, last_name, gender, born, ability) in enumerate(STUDENTS, start=1):
            program = self.programs[program_key]
            entry_year = current_year - level // 100 + 1
            matric_no = f"{program.department.code}/{entry_year}/{n:04d}"
            user = self.make_user(
                f"student{n}", matric_no, first_name, last_name, User.Role.STUDENT, program.department
            )
            student, _ = StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    "matric_no": matric_no,
                    "program": program,
                    "level": level,
                    "gender": gender,
                    "date_of_birth": date.fromisoformat(born),
                    "entry_session": self.sessions[f"{entry_year}/{entry_year + 1}"],
                    "phone": f"0806 120 {n:04d}",
                    "address": ADDRESSES[n % len(ADDRESSES)],
                },
            )
            self.students.append(student)
            self.ability[student.pk] = ability
            self.number[student.pk] = n

    def seed_courses(self):
        self.course_programs = {}
        courses = {}
        for code, title, units, program_keys in COURSES:
            number = int(code[4:])
            term = FIRST if number % 2 else SECOND
            course, _ = Course.objects.update_or_create(
                code=code,
                defaults={
                    "department": self.departments[code[:3]],
                    "title": title,
                    "units": units,
                    "level": number // 100 * 100,
                    "semester_term": term,
                },
            )
            programs = [self.programs[key] for key in program_keys]
            course.programs.set(programs)
            self.course_programs[code] = {program.pk for program in programs}
            courses[code] = course

        self.offerings = []
        for key, plan in OFFERINGS.items():
            for code, (lecturer, _, _) in plan.items():
                offering, _ = CourseOffering.objects.update_or_create(
                    course=courses[code],
                    semester=self.semesters[key],
                    defaults={"lecturer": self.lecturers[lecturer]},
                )
                self.offerings.append((key, offering))

    def seed_registrations(self):
        units = defaultdict(int)
        planned = defaultdict(list)
        for key, offering in self.offerings:
            course = offering.course
            # last session's students were a level below where they are now
            level_now = course.level + (0 if key == CURRENT else 100)
            for student in self.students:
                if key == CURRENT and CURRENT_FORMS.get(self.number[student.pk], ()) is None:
                    continue
                if student.level != level_now or student.program_id not in self.course_programs[course.code]:
                    continue
                if units[(student.pk, key)] + course.units > settings.MAX_UNITS_PER_SEMESTER:
                    continue
                units[(student.pk, key)] += course.units
                planned[(student, key)].append(offering)

        forms, registrations = [], []
        for (student, key), offerings in planned.items():
            form = self.save_form(student, key)
            forms.append(form.pk)
            for offering in offerings:
                registration, _ = CourseRegistration.objects.update_or_create(
                    student=student, offering=offering, defaults={"semester_registration": form}
                )
                registrations.append(registration.pk)

        # whatever an earlier run registered that the plan has since dropped, student1's current courses included
        stale = CourseRegistration.objects.filter(offering__in=[offering for _, offering in self.offerings]).exclude(
            pk__in=registrations
        )
        ResultEntry.objects.filter(registration__in=stale).delete()
        stale.delete()
        SemesterRegistration.objects.filter(student__in=self.students).exclude(pk__in=forms).delete()

    def save_form(self, student, key):
        number = self.number[student.pk]
        status, reason = (CURRENT_FORMS.get(number) if key == CURRENT else None) or (Form.VALIDATED, "")
        submitted_at = REGISTERED_FROM[key] + timedelta(hours=number)
        validated = status == Form.VALIDATED
        form, _ = SemesterRegistration.objects.update_or_create(
            student=student,
            semester=self.semesters[key],
            defaults={
                "status": status,
                "submitted_at": submitted_at,
                "return_reason": reason,
                "validated_by": self.dept_admins[student.program.department.code] if validated else None,
                "validated_at": submitted_at + timedelta(days=2) if validated else None,
            },
        )
        return form

    def seed_results(self):
        for position, (key, offering) in enumerate(self.offerings):
            code = offering.course.code
            _, status, fill = OFFERINGS[key][code]
            registrations = offering.registrations.select_related("student")
            on_sheet = validated_registrations(registrations).order_by("student__matric_no")
            ResultEntry.objects.filter(registration__in=registrations.exclude(pk__in=on_sheet)).delete()
            for row, registration in enumerate(on_sheet):
                self.save_scores(registration, key, code, fill, row, graded=status != Status.DRAFT)
            self.update_sheet(offering, key, status, position)

    def save_scores(self, registration, key, code, fill, row, graded):
        student = registration.student
        ca, exam = demo_scores(self.ability[student.pk], student.matric_no, code)
        ca, exam = FORCED_SCORES.get((self.number[student.pk], key, code), (ca, exam))
        if fill == "partial":
            ca, exam = [(ca, None), (None, exam), (ca, exam), (None, None)][row % 4]
        elif fill is None:
            ca = exam = None

        if ca is None and exam is None:
            ResultEntry.objects.filter(registration=registration).delete()
            return

        total = grade = point = None
        if graded:
            total = ca + exam
            band = grade_for(total, self.bands)
            grade, point = band.grade, band.point
        ResultEntry.objects.update_or_create(
            registration=registration,
            defaults={"ca_score": ca, "exam_score": exam, "total": total, "grade": grade, "grade_point": point},
        )

    def update_sheet(self, offering, key, status, position):
        sheet = offering.result_sheet
        sheet.status = status
        sheet.feedback = FEEDBACK.get(offering.course.code, "") if status == Status.REJECTED else ""
        sheet.submitted_by = sheet.submitted_at = sheet.reviewed_by = sheet.reviewed_at = None
        if status != Status.DRAFT:
            sheet.submitted_by = offering.lecturer.user
            sheet.submitted_at = office_hours(SUBMITTED_FROM[key], position)
        if status in (Status.APPROVED, Status.REJECTED):
            sheet.reviewed_by = self.dept_admins[offering.course.department.code]
            sheet.reviewed_at = sheet.submitted_at + timedelta(days=2, hours=1, minutes=12)
        sheet.save()
        self.write_history(sheet)

    def write_history(self, sheet):
        # a rerun resets the sheet, so whatever was logged against it no longer describes it
        AuditLog.objects.filter(entity_type=ResultSheet._meta.label_lower, entity_id=str(sheet.pk)).delete()
        if sheet.status == Status.DRAFT:
            return
        count = results.class_list(sheet).count()
        submission = results.record(
            sheet.submitted_by,
            "RESULTS_SUBMITTED",
            sheet,
            Status.DRAFT,
            {"status": Status.SUBMITTED, "count": count, "blanks": 0},
            details=results.submitted_details(count, 0),
        )
        events = [(submission, sheet.submitted_at)]
        if sheet.status == Status.APPROVED:
            review = results.record(sheet.reviewed_by, "RESULTS_APPROVED", sheet, Status.SUBMITTED, {"status": Status.APPROVED})
            events.append((review, sheet.reviewed_at))
        elif sheet.status == Status.REJECTED:
            review = results.record(
                sheet.reviewed_by,
                "RESULTS_REJECTED",
                sheet,
                Status.SUBMITTED,
                {"status": Status.REJECTED, "feedback": sheet.feedback},
                details=sheet.feedback,
            )
            events.append((review, sheet.reviewed_at))
        for row, at in events:
            AuditLog.objects.filter(pk=row.pk).update(created_at=at)

    def print_logins(self):
        rows = [
            (user.get_role_display(), user.email, identifier, user.department.code if user.department else "-")
            for user, identifier in self.logins
        ]
        width = max(len(email) for _, email, _, _ in rows)
        self.stdout.write(f"{'Role':<17}{'Email':<{width + 2}}{'ID':<15}Department")
        for role, email, identifier, department in rows:
            self.stdout.write(f"{role:<17}{email:<{width + 2}}{identifier:<15}{department}")
        self.stdout.write(
            self.style.SUCCESS(
                f"{len(rows)} demo accounts ready. Password: SEED_PASSWORD, or {DEFAULT_PASSWORD} when it is unset."
            )
        )
