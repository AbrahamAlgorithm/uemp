from collections import defaultdict

from django.db.models import Case, IntegerField, Value, When
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import CourseOffering
from apps.registrations.views import int_param, semester_in_progress, student_of
from core.permissions import MANAGERS, HasRole, IsDeptAdmin, IsLecturer, IsStudent
from core.scoping import DepartmentScopedQuerysetMixin
from core.viewsets import PagePagination

from . import services
from .grading import FAIL, approved_entries, cgpa, gpa, summarise
from .models import GradeScale, ResultSheet
from .serializers import (
    GradeScaleSerializer,
    IncompleteEntrySerializer,
    LecturerOfferingSerializer,
    RejectSheetSerializer,
    ReopenSheetSerializer,
    SaveScoresSerializer,
    SheetDetailSerializer,
    SheetSummarySerializer,
    StudentResultsSerializer,
    SubmissionSerializer,
    SubmitSheetSerializer,
    course_ref,
)

SHEET_RELATIONS = (
    "offering__course__department",
    "offering__semester__session",
    "offering__lecturer__user",
    "submitted_by",
    "reviewed_by",
)

IncompleteSerializer = inline_serializer(
    name="IncompleteScores",
    fields={"detail": serializers.CharField(), "incomplete": IncompleteEntrySerializer(many=True)},
)


class GradeScaleView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="The grade bands, highest first", responses=GradeScaleSerializer(many=True))
    def get(self, request):
        return Response(GradeScaleSerializer(GradeScale.objects.order_by("-min_score"), many=True).data)


def sheet_detail(sheet):
    services.ensure_entries(sheet)
    entries = list(services.class_list(sheet))
    context = {
        "entries": entries,
        "carry_overs": services.carry_over_students(sheet.offering, entries),
        "summary": summarise(entries, services.scale()),
        "timelines": services.timelines([sheet]),
    }
    return SheetDetailSerializer(sheet, context=context).data


def reloaded(sheet):
    return ResultSheet.objects.select_related(*SHEET_RELATIONS).get(pk=sheet.pk)


def sheet_summaries(sheets, serializer_class=SheetSummarySerializer):
    sheets = list(sheets)
    context = {"counts": services.class_counts([sheet.offering_id for sheet in sheets])}
    if serializer_class is SubmissionSerializer:
        context["timelines"] = services.timelines(sheets)
    return serializer_class(sheets, many=True, context=context).data


class LecturerOfferingViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsLecturer]
    serializer_class = LecturerOfferingSerializer
    queryset = CourseOffering.objects.all()

    def get_queryset(self):
        # another lecturer's offering 404s rather than admitting it exists
        return CourseOffering.objects.filter(lecturer__user=self.request.user).select_related(
            "course", "semester__session", "result_sheet"
        )

    def sheet_of(self):
        return reloaded(self.get_object().result_sheet)

    @extend_schema(
        summary="The lecturer's offerings for a semester, the current one unless given",
        parameters=[OpenApiParameter("semester", int)],
    )
    def list(self, request, *args, **kwargs):
        semester_id = int_param(request, "semester") or semester_in_progress().pk
        offerings = list(self.get_queryset().filter(semester_id=semester_id).order_by("course__code"))
        counts = services.class_counts([offering.pk for offering in offerings])
        rows = [
            {
                "id": offering.pk,
                "course": course_ref(offering.course),
                "semester": offering.semester,
                "sheet_id": offering.result_sheet.pk,
                "sheet_status": offering.result_sheet.status,
                "student_count": services.student_count(offering.result_sheet, counts),
                "scored_count": counts.get(offering.pk, {}).get("scored", 0),
            }
            for offering in offerings
        ]
        return Response(LecturerOfferingSerializer(rows, many=True).data)

    @extend_schema(summary="The offering's result sheet with its class list", responses=SheetDetailSerializer)
    @action(detail=True, methods=["get"])
    def sheet(self, request, pk=None):
        return Response(sheet_detail(self.sheet_of()))

    @extend_schema(
        summary="Save some or all of the sheet's scores",
        request=SaveScoresSerializer,
        responses={
            200: SheetDetailSerializer,
            400: OpenApiResponse(description="Out-of-range scores, or students who aren't on the class list"),
            409: OpenApiResponse(description="The sheet is submitted or approved"),
        },
    )
    @action(detail=True, methods=["patch"], url_path="sheet/entries", url_name="sheet-entries")
    def entries(self, request, pk=None):
        serializer = SaveScoresSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sheet = services.save_scores(self.sheet_of(), serializer.validated_data["entries"], request.user, request)
        return Response(sheet_detail(reloaded(sheet)))

    @extend_schema(
        summary="Submit the sheet for review",
        request=SubmitSheetSerializer,
        responses={
            200: SheetDetailSerializer,
            400: IncompleteSerializer,
            409: OpenApiResponse(description="The sheet is already submitted or approved, or has no students"),
        },
    )
    @action(detail=True, methods=["post"], url_path="sheet/submit", url_name="sheet-submit")
    def submit(self, request, pk=None):
        serializer = SubmitSheetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            sheet = services.submit_sheet(
                self.sheet_of(), request.user, serializer.validated_data["confirm_incomplete"], request
            )
        except services.IncompleteScores as error:
            body = {"detail": str(error), "incomplete": IncompleteEntrySerializer(error.entries, many=True).data}
            return Response(body, status=status.HTTP_400_BAD_REQUEST)
        return Response(sheet_detail(reloaded(sheet)))


class LecturerSubmissionsView(APIView):
    permission_classes = [IsLecturer]

    @extend_schema(summary="Every result sheet the lecturer owns, with its review timeline", responses=SubmissionSerializer(many=True))
    def get(self, request):
        sheets = (
            ResultSheet.objects.select_related(*SHEET_RELATIONS)
            .filter(offering__lecturer__user=request.user)
            .order_by("-offering__semester__session__name", "-offering__semester__term", "offering__course__code")
        )
        return Response(sheet_summaries(sheets, SubmissionSerializer))


@extend_schema(
    parameters=[
        OpenApiParameter("status", str, enum=ResultSheet.Status.values),
        OpenApiParameter("semester", int),
        OpenApiParameter("department", int, description="The course's department"),
        OpenApiParameter("course", int),
    ]
)
class ResultSheetViewSet(DepartmentScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasRole(*MANAGERS)]
    pagination_class = PagePagination
    # the course's department reviews it, whichever departments its students come from
    department_lookup = "offering__course__department"
    queryset = ResultSheet.objects.select_related(*SHEET_RELATIONS)
    serializer_class = SheetSummarySerializer

    def filter_queryset(self, queryset):
        filters = (
            ("semester", "offering__semester"),
            ("department", "offering__course__department"),
            ("course", "offering__course"),
        )
        for name, lookup in filters:
            value = int_param(self.request, name)
            if value is not None:
                queryset = queryset.filter(**{lookup: value})
        sheet_status = self.request.query_params.get("status")
        if sheet_status:
            if sheet_status not in ResultSheet.Status.values:
                raise ValidationError({"status": f"Must be one of {', '.join(ResultSheet.Status.values)}."})
            queryset = queryset.filter(status=sheet_status)
        awaiting_first = Case(
            When(status=ResultSheet.Status.SUBMITTED, then=Value(0)), default=Value(1), output_field=IntegerField()
        )
        return queryset.order_by(
            awaiting_first, "-offering__semester__session__name", "-offering__semester__term", "offering__course__code"
        )

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.filter_queryset(self.get_queryset()))
        return self.get_paginated_response(sheet_summaries(page))

    @extend_schema(responses=SheetDetailSerializer)
    def retrieve(self, request, *args, **kwargs):
        return Response(sheet_detail(self.get_object()))

    @extend_schema(summary="Approve submitted results and publish them to students", request=None, responses=SheetDetailSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsDeptAdmin])
    def approve(self, request, pk=None):
        sheet = services.approve_sheet(self.get_object(), request.user, request)
        return Response(sheet_detail(reloaded(sheet)))

    @extend_schema(summary="Send submitted results back to the lecturer", request=RejectSheetSerializer, responses=SheetDetailSerializer)
    @action(detail=True, methods=["post"], permission_classes=[IsDeptAdmin])
    def reject(self, request, pk=None):
        serializer = RejectSheetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sheet = services.reject_sheet(self.get_object(), request.user, serializer.validated_data["feedback"], request)
        return Response(sheet_detail(reloaded(sheet)))

    @extend_schema(summary="Withdraw approved results so the lecturer can correct them", request=ReopenSheetSerializer, responses=SheetDetailSerializer)
    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        serializer = ReopenSheetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sheet = services.reopen_sheet(self.get_object(), request.user, serializer.validated_data["reason"], request)
        return Response(sheet_detail(reloaded(sheet)))


def student_results(student):
    entries = (
        approved_entries()
        .filter(registration__student=student)
        .select_related("registration__offering__course", "registration__offering__semester__session")
        .order_by(
            "registration__offering__semester__session__name",
            "registration__offering__semester__term",
            "registration__offering__course__code",
        )
    )
    semesters, courses = {}, defaultdict(list)
    last_grade = {}
    for entry in entries:
        offering = entry.registration.offering
        course = offering.course
        semesters.setdefault(offering.semester_id, offering.semester)
        courses[offering.semester_id].append(
            {
                "registration_id": entry.registration_id,
                "code": course.code,
                "title": course.title,
                "units": course.units,
                "ca": entry.ca_score,
                "exam": entry.exam_score,
                "total": entry.total,
                "grade": entry.grade,
                "point": entry.grade_point,
                "is_carry_over": last_grade.get(course.pk) == FAIL,
            }
        )
        last_grade[course.pk] = entry.grade

    lines = [line for semester_lines in courses.values() for line in semester_lines]
    return {
        "student": student,
        "semesters": [
            {
                "semester": semester,
                "courses": courses[semester_id],
                "units": sum(line["units"] for line in courses[semester_id]),
                "gpa": gpa(student, semester),
            }
            for semester_id, semester in semesters.items()
        ],
        "cgpa": cgpa(student),
        "units_attempted": sum(line["units"] for line in lines),
        "units_passed": sum(line["units"] for line in lines if line["grade"] != FAIL),
    }


class StudentResultsView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(summary="The student's approved results by semester, with GPA and CGPA", responses=StudentResultsSerializer)
    def get(self, request):
        return Response(StudentResultsSerializer(student_results(student_of(request))).data)
