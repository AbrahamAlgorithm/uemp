from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Avg, Count, Max, Min, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Department, Semester
from apps.accounts.models import StudentProfile, User
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import SemesterRegistration
from apps.registrations.serializers import SemesterBriefSerializer
from apps.registrations.services import current_semester
from apps.registrations.views import int_param
from apps.results.grading import AT_RISK_CGPA, FAIL, active_bands, approved_entries, average_by
from apps.results.models import ResultSheet
from core.negotiation import FormatIsFileType
from core.permissions import MANAGERS, HasRole, IsSuperAdmin

from .exports import csv_response, filename

TWO_PLACES = Decimal("0.01")
FORMATS = ("json", "csv")

PARAMETERS = [
    OpenApiParameter("department", int, description="Super admin only; department admins always get their own"),
    OpenApiParameter("semester", int, description="The current semester unless given"),
    OpenApiParameter("format", str, enum=list(FORMATS), default="json"),
]


def column(key, label):
    return {"key": key, "label": label}


def table(title, columns, rows):
    return {"title": title, "columns": [column(*item) for item in columns], "rows": rows}


def two_places(value):
    return None if value is None else Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def percent(part, whole):
    return two_places(Decimal(100 * part) / whole) if whole else None


def mean(values):
    values = list(values)
    return two_places(sum(values) / len(values)) if values else None


def person_name(user):
    return user.get_full_name() or user.email


def report_scope(request):
    if request.user.role == User.Role.DEPT_ADMIN:
        return request.user.department
    pk = int_param(request, "department")
    return get_object_or_404(Department, pk=pk) if pk else None


def report_semester(request):
    pk = int_param(request, "semester")
    if pk:
        return get_object_or_404(Semester.objects.select_related("session"), pk=pk)
    return current_semester()


def student_filter(prefix, department=None, level=None, program=None):
    query = Q()
    if department:
        query &= Q(**{f"{prefix}program__department": department})
    if level:
        query &= Q(**{f"{prefix}level": level})
    if program:
        query &= Q(**{f"{prefix}program": program})
    return query


class ReportView(APIView):
    permission_classes = [HasRole(*MANAGERS)]
    content_negotiation_class = FormatIsFileType
    slug = ""
    title = ""

    def build(self, request, department, semester):
        raise NotImplementedError

    @extend_schema(parameters=PARAMETERS, responses={200: None})
    def get(self, request):
        output = request.query_params.get("format", "json")
        if output not in FORMATS:
            raise ValidationError({"format": "Choose json or csv."})
        department, semester = report_scope(request), report_semester(request)
        tables = self.build(request, department, semester)
        if output == "csv":
            return csv_response(tables, filename(self.slug, department, semester))
        return Response(
            {
                "title": self.title,
                "department": {"id": department.pk, "code": department.code, "name": department.name} if department else None,
                "semester": SemesterBriefSerializer(semester).data if semester else None,
                "tables": tables,
            }
        )


class StudentsReport(ReportView):
    slug, title = "students", "Student list"

    @extend_schema(parameters=[*PARAMETERS, OpenApiParameter("level", int), OpenApiParameter("program", int)], responses={200: None})
    def get(self, request):
        return super().get(request)

    def build(self, request, department, semester):
        level, program = int_param(request, "level"), int_param(request, "program")
        students = (
            StudentProfile.objects.filter(student_filter("", department, level, program))
            .select_related("user", "program")
            .order_by("matric_no")
        )
        cgpas = average_by(
            approved_entries().filter(student_filter("registration__student__", department, level, program)),
            "registration__student_id",
        )
        rows = [
            {
                "matric_no": student.matric_no,
                "name": person_name(student.user),
                "program": f"{student.program.award} {student.program.name}",
                "level": student.level,
                "status": student.user.get_status_display(),
                "cgpa": cgpas.get(student.pk, {}).get("cgpa"),
            }
            for student in students
        ]
        columns = [("matric_no", "Matric no"), ("name", "Name"), ("program", "Program"), ("level", "Level"), ("status", "Status"), ("cgpa", "CGPA")]
        return [table("Students", columns, rows)]


class RegistrationsReport(ReportView):
    slug, title = "registrations", "Registrations by course"

    def build(self, request, department, semester):
        offerings = CourseOffering.objects.none() if semester is None else CourseOffering.objects.filter(semester=semester)
        if department:
            offerings = offerings.filter(course__department=department)
        offerings = (
            offerings.select_related("course__department", "lecturer__user")
            .annotate(
                registered=Count("registrations"),
                validated=Count(
                    "registrations", filter=Q(registrations__semester_registration__status=SemesterRegistration.Status.VALIDATED)
                ),
            )
            .order_by("course__code")
        )
        rows = [
            {
                "department": offering.course.department.code,
                "code": offering.course.code,
                "title": offering.course.title,
                "units": offering.course.units,
                "lecturer": person_name(offering.lecturer.user) if offering.lecturer else "Unallocated",
                "registered": offering.registered,
                "validated": offering.validated,
            }
            for offering in offerings
        ]
        columns = [
            ("department", "Dept"), ("code", "Code"), ("title", "Title"), ("units", "Units"),
            ("lecturer", "Lecturer"), ("registered", "Registered"), ("validated", "Validated"),
        ]
        return [table("Registrations by course", columns, rows)]


class PerformanceReport(ReportView):
    slug, title = "performance", "Performance by course"

    def build(self, request, department, semester):
        entries = approved_entries().filter(registration__offering__semester=semester) if semester else approved_entries().none()
        if department:
            entries = entries.filter(registration__offering__course__department=department)
        grades = [band["grade"] for band in active_bands()]
        offering = "registration__offering__"
        grouped = (
            entries.order_by()
            .values(f"{offering}course__code", f"{offering}course__title", f"{offering}course__level")
            .annotate(
                count=Count("pk"),
                average=Avg("total"),
                highest=Max("total"),
                lowest=Min("total"),
                passed=Count("pk", filter=~Q(grade=FAIL)),
                **{f"g{index}": Count("pk", filter=Q(grade=grade)) for index, grade in enumerate(grades)},
            )
            .order_by(f"{offering}course__code")
        )
        rows = [
            {
                "code": row[f"{offering}course__code"],
                "title": row[f"{offering}course__title"],
                "level": row[f"{offering}course__level"],
                "count": row["count"],
                "average": two_places(row["average"]),
                "highest": row["highest"],
                "lowest": row["lowest"],
                "pass_rate": percent(row["passed"], row["count"]),
                **{f"grade_{grade}": row[f"g{index}"] for index, grade in enumerate(grades)},
            }
            for row in grouped
        ]
        columns = [
            ("code", "Code"), ("title", "Title"), ("level", "Level"), ("count", "Students"), ("average", "Average"),
            ("highest", "Highest"), ("lowest", "Lowest"), ("pass_rate", "Pass rate (%)"),
            *[(f"grade_{grade}", grade) for grade in grades],
        ]

        gpas = average_by(entries, "registration__student_id")
        levels = dict(StudentProfile.objects.filter(pk__in=gpas).values_list("pk", "level"))
        by_level = {}
        for student_id, figures in gpas.items():
            by_level.setdefault(levels[student_id], []).append(figures["cgpa"])
        level_rows = [
            {"level": level, "students": len(values), "average_gpa": mean(values)} for level, values in sorted(by_level.items())
        ]
        return [
            table("Performance by course", columns, rows),
            table("Average GPA by level", [("level", "Level"), ("students", "Students"), ("average_gpa", "Average GPA")], level_rows),
        ]


class AtRiskReport(ReportView):
    slug, title = "at-risk", f"Students with a CGPA below {AT_RISK_CGPA}"

    def build(self, request, department, semester):
        entries = approved_entries().filter(student_filter("registration__student__", department))
        figures = {
            student_id: row for student_id, row in average_by(entries, "registration__student_id").items() if row["cgpa"] < AT_RISK_CGPA
        }
        students = StudentProfile.objects.filter(pk__in=figures).select_related("user", "program")
        rows = sorted(
            (
                {
                    "matric_no": student.matric_no,
                    "name": person_name(student.user),
                    "program": f"{student.program.award} {student.program.name}",
                    "level": student.level,
                    "cgpa": figures[student.pk]["cgpa"],
                    "failed_courses": figures[student.pk]["failed"],
                }
                for student in students
            ),
            key=lambda row: (row["cgpa"], row["matric_no"]),
        )
        columns = [
            ("matric_no", "Matric no"), ("name", "Name"), ("program", "Program"), ("level", "Level"),
            ("cgpa", "CGPA"), ("failed_courses", "Failed courses"),
        ]
        return [table(self.title, columns, rows)]


class DepartmentsReport(ReportView):
    permission_classes = [IsSuperAdmin]
    slug, title = "departments", "Departments compared"

    def build(self, request, department, semester):
        def grouped(queryset, key, **counts):
            return {row[key]: row for row in queryset.order_by().values(key).annotate(total=Count("pk"), **counts)}

        students = grouped(StudentProfile.objects.all(), "program__department")
        staff = grouped(User.objects.exclude(role=User.Role.STUDENT).filter(department__isnull=False), "department")
        courses = grouped(Course.objects.all(), "department")
        forms = grouped(
            SemesterRegistration.objects.filter(semester=semester),
            "student__program__department",
            validated=Count("pk", filter=Q(status=SemesterRegistration.Status.VALIDATED)),
        )
        sheets = grouped(
            ResultSheet.objects.filter(offering__semester=semester),
            "offering__course__department",
            approved=Count("pk", filter=Q(status=ResultSheet.Status.APPROVED)),
        )
        cgpas = average_by(approved_entries(), "registration__student_id")
        student_departments = dict(StudentProfile.objects.values_list("pk", "program__department"))
        by_department = {}
        for student_id, figures in cgpas.items():
            by_department.setdefault(student_departments[student_id], []).append(figures["cgpa"])

        rows = []
        for item in Department.objects.order_by("name"):
            form, sheet = forms.get(item.pk), sheets.get(item.pk)
            rows.append(
                {
                    "department": item.name,
                    "students": students.get(item.pk, {}).get("total", 0),
                    "staff": staff.get(item.pk, {}).get("total", 0),
                    "courses": courses.get(item.pk, {}).get("total", 0),
                    "validation_rate": percent(form["validated"], form["total"]) if form else None,
                    "approval_rate": percent(sheet["approved"], sheet["total"]) if sheet else None,
                    "average_cgpa": mean(by_department.get(item.pk, [])),
                }
            )
        columns = [
            ("department", "Department"), ("students", "Students"), ("staff", "Staff"), ("courses", "Courses"),
            ("validation_rate", "Validation rate (%)"), ("approval_rate", "Approval rate (%)"), ("average_cgpa", "Average CGPA"),
        ]
        return [table("Departments compared", columns, rows)]
