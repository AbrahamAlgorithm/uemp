from django.db.models import Count
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import Department, Faculty, Semester
from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditRowSerializer, feed, recent_rows
from apps.courses.models import Course, CourseOffering
from apps.registrations.models import SemesterRegistration
from apps.registrations.serializers import SemesterBriefSerializer
from apps.registrations.services import current_semester
from apps.results import services as results
from apps.results.models import ResultSheet
from apps.results.records import NOT_SUBMITTED, Transcript
from apps.results.serializers import course_ref
from core.permissions import IsDeptAdmin, IsLecturer, IsStudent, IsSuperAdmin
from core.viewsets import PagePagination

Sheet = ResultSheet.Status
Form = SemesterRegistration.Status


def semester_data(semester):
    return SemesterBriefSerializer(semester).data if semester else None


def coded(department):
    return {"id": department.pk, "code": department.code, "name": department.name}


class StudentDashboardView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(summary="The signed-in student's overview", responses={200: None})
    def get(self, request):
        profile = (
            StudentProfile.objects.select_related("user", "program__department__faculty", "entry_session")
            .filter(user=request.user)
            .first()
        )
        if profile is None:
            raise Http404("There's no student record for this account.")
        department = profile.program.department
        semester = current_semester()
        form = SemesterRegistration.objects.filter(student=profile, semester=semester).first() if semester else None
        transcript = Transcript(profile)
        return Response(
            {
                "name": profile.user.get_full_name() or profile.user.email,
                "first_name": profile.user.first_name,
                "matric_no": profile.matric_no,
                "email": profile.user.email,
                "status": profile.user.status,
                "faculty": {"id": department.faculty.pk, "code": department.faculty.code, "name": department.faculty.name},
                "department": coded(department),
                "program": {"id": profile.program_id, "name": profile.program.name, "award": profile.program.award},
                "level": profile.level,
                "entry_session": profile.entry_session.name if profile.entry_session else None,
                "cgpa": transcript.cgpa,
                "semester": semester_data(semester),
                "registration": {
                    "status": form.status if form else NOT_SUBMITTED,
                    "return_reason": form.return_reason if form else "",
                    "registration_open": bool(semester and semester.registration_open),
                },
                "carry_overs": transcript.outstanding_carry_overs(),
            }
        )


class LecturerDashboardView(APIView):
    permission_classes = [IsLecturer]

    @extend_schema(summary="The lecturer's courses this semester and what needs action", responses={200: None})
    def get(self, request):
        semester = current_semester()
        offerings = (
            list(
                CourseOffering.objects.filter(lecturer__user=request.user, semester=semester)
                .select_related("course", "result_sheet")
                .order_by("course__code")
            )
            if semester
            else []
        )
        counts = results.class_counts([offering.pk for offering in offerings])
        rows = [
            {
                "id": offering.pk,
                "course": course_ref(offering.course),
                "sheet_id": offering.result_sheet.pk,
                "sheet_status": offering.result_sheet.status,
                "feedback": offering.result_sheet.feedback,
                "student_count": results.student_count(offering.result_sheet, counts),
                "scored_count": counts.get(offering.pk, {}).get("scored", 0),
            }
            for offering in offerings
        ]
        return Response(
            {
                "semester": semester_data(semester),
                "offerings": rows,
                "needs_action": sum(1 for row in rows if row["sheet_status"] in (Sheet.DRAFT, Sheet.REJECTED)),
            }
        )


class LecturerSemestersView(APIView):
    permission_classes = [IsLecturer]

    @extend_schema(summary="Semesters the lecturer has courses in, newest first", responses={200: None})
    def get(self, request):
        semesters = (
            Semester.objects.filter(offerings__lecturer__user=request.user)
            .select_related("session")
            .distinct()
            .order_by("-session__name", "-term")
        )
        return Response(SemesterBriefSerializer(semesters, many=True).data)


def pending_forms(**filters):
    return SemesterRegistration.objects.filter(status=Form.SUBMITTED, **filters)


def pending_sheets(**filters):
    return ResultSheet.objects.filter(status=Sheet.SUBMITTED, **filters)


class DepartmentDashboardView(APIView):
    permission_classes = [IsDeptAdmin]

    @extend_schema(summary="Counts, items awaiting review and recent activity for the admin's department", responses={200: None})
    def get(self, request):
        department = request.user.department
        semester = current_semester()
        current_offerings = CourseOffering.objects.filter(course__department=department, semester=semester) if semester else CourseOffering.objects.none()
        return Response(
            {
                "department": {**coded(department), "faculty": department.faculty.name},
                "semester": semester_data(semester),
                "counts": {
                    "students": StudentProfile.objects.filter(program__department=department).count(),
                    "lecturers": User.objects.filter(
                        role=User.Role.LECTURER, department=department, status=User.Status.ACTIVE
                    ).count(),
                    "courses": Course.objects.filter(department=department).count(),
                    "current_offerings": current_offerings.count(),
                    "unallocated_offerings": current_offerings.filter(lecturer__isnull=True).count(),
                },
                "awaiting_validation": pending_forms(student__program__department=department).count(),
                "awaiting_review": pending_sheets(offering__course__department=department).count(),
                "recent_activity": recent_rows(AuditLog.objects.filter(department=department)),
            }
        )


class DepartmentActivityView(APIView):
    permission_classes = [IsDeptAdmin]

    @extend_schema(summary="Everything notable that happened in the admin's department, newest first", responses={200: None})
    def get(self, request):
        paginator = PagePagination()
        page = paginator.paginate_queryset(feed(AuditLog.objects.filter(department=request.user.department)), request, view=self)
        return paginator.get_paginated_response(AuditRowSerializer(page, many=True).data)


class AdminDashboardView(APIView):
    permission_classes = [IsSuperAdmin]

    @extend_schema(summary="University totals, each department's workload and recent activity", responses={200: None})
    def get(self, request):
        semester = current_semester()
        students = dict(
            StudentProfile.objects.order_by().values_list("program__department").annotate(total=Count("pk"))
        )
        forms = dict(pending_forms().order_by().values_list("student__program__department").annotate(total=Count("pk")))
        sheets = dict(pending_sheets().order_by().values_list("offering__course__department").annotate(total=Count("pk")))
        departments = Department.objects.select_related("faculty").order_by("faculty__name", "name")
        return Response(
            {
                "semester": semester_data(semester),
                "totals": {
                    "students": sum(students.values()),
                    "lecturers": User.objects.filter(role=User.Role.LECTURER, status=User.Status.ACTIVE).count(),
                    "faculties": Faculty.objects.count(),
                    "departments": len(departments),
                    "courses": Course.objects.count(),
                    "staff": StaffProfile.objects.count(),
                    "awaiting_validation": sum(forms.values()),
                    "awaiting_review": sum(sheets.values()),
                },
                "departments": [
                    {
                        **coded(department),
                        "faculty": department.faculty.name,
                        "students": students.get(department.pk, 0),
                        "awaiting_validation": forms.get(department.pk, 0),
                        "awaiting_review": sheets.get(department.pk, 0),
                    }
                    for department in departments
                ],
                "recent_activity": recent_rows(AuditLog.objects.all()),
            }
        )
