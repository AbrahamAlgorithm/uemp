from django.conf import settings
from django.db.models import Case, Count, IntegerField, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import CourseOffering
from core.permissions import MANAGERS, HasRole, IsStudent
from core.scoping import DepartmentScopedQuerysetMixin, department_scope
from core.viewsets import PagePagination

from .models import CourseRegistration, SemesterRegistration
from .serializers import (
    CourseRegistrationSerializer,
    FormDetailSerializer,
    FormSummarySerializer,
    RegistrationOverviewSerializer,
    ReturnRegistrationSerializer,
    SubmitRegistrationSerializer,
)
from .services import current_semester, registration_options, return_registration, submit_registration, validate_registration

FORM_RELATIONS = ("student__user", "student__program__department__faculty", "semester__session", "validated_by")


def int_param(request, name):
    value = request.query_params.get(name)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError as error:
        raise ValidationError({name: "Must be a whole number."}) from error


def student_of(request):
    student = getattr(request.user, "student_profile", None)
    if student is None:
        raise Http404("There's no student record for this account.")
    return student


def semester_in_progress():
    semester = current_semester()
    if semester is None:
        raise Http404("No semester is in progress.")
    return semester


def overview(student, semester):
    form = SemesterRegistration.objects.select_related("validated_by").filter(student=student, semester=semester).first()
    selected = set(form.course_registrations.values_list("offering_id", flat=True)) if form else None
    courses = []
    for offering, is_carry_over in registration_options(student, semester):
        courses.append(
            {
                "offering_id": offering.pk,
                "code": offering.course.code,
                "title": offering.course.title,
                "units": offering.course.units,
                "level": offering.course.level,
                "lecturer": offering.lecturer.user.get_full_name() if offering.lecturer else None,
                "is_carry_over": is_carry_over,
                # carry-overs start ticked until the student has submitted a choice of their own
                "is_selected": is_carry_over if selected is None else offering.pk in selected,
            }
        )
    return {
        "semester": semester,
        "registration_open": semester.registration_open,
        "max_units": settings.MAX_UNITS_PER_SEMESTER,
        "registration": form,
        "courses": courses,
    }


class StudentRegistrationView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(summary="This semester's registration and the courses open to the student", responses=RegistrationOverviewSerializer)
    def get(self, request):
        return Response(RegistrationOverviewSerializer(overview(student_of(request), semester_in_progress())).data)

    @extend_schema(
        summary="Replace the student's course selection and submit it",
        request=SubmitRegistrationSerializer,
        responses={
            200: RegistrationOverviewSerializer,
            400: OpenApiResponse(description="An error for each offering id that can't be registered"),
            409: OpenApiResponse(description="Registration is closed or already validated"),
        },
    )
    def put(self, request):
        serializer = SubmitRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student = student_of(request)
        submit_registration(student, serializer.validated_data["offering_ids"], request.user, request)
        return Response(RegistrationOverviewSerializer(overview(student, semester_in_progress())).data)


class RegistrationSlipView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(
        summary="The student's registration slip, for the current semester unless one is given",
        parameters=[OpenApiParameter("semester", int)],
        responses=FormDetailSerializer,
    )
    def get(self, request):
        student = student_of(request)
        semester_id = int_param(request, "semester") or semester_in_progress().pk
        form = SemesterRegistration.objects.select_related(*FORM_RELATIONS).filter(student=student, semester_id=semester_id).first()
        if form is None:
            raise Http404("You haven't submitted a registration for this semester.")
        return Response(FormDetailSerializer(form).data)


class StudentRegistrationHistoryView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(
        summary="Every registration the student has submitted",
        parameters=[OpenApiParameter("semester", int)],
        responses=FormDetailSerializer(many=True),
    )
    def get(self, request):
        forms = (
            SemesterRegistration.objects.select_related(*FORM_RELATIONS)
            .filter(student=student_of(request))
            .order_by("-semester__session__name", "-semester__term")
        )
        semester_id = int_param(request, "semester")
        if semester_id:
            forms = forms.filter(semester_id=semester_id)
        return Response(FormDetailSerializer(forms, many=True).data)


@extend_schema(
    parameters=[
        OpenApiParameter("semester", int),
        OpenApiParameter("status", str, enum=SemesterRegistration.Status.values),
        OpenApiParameter("level", int),
        OpenApiParameter("program", int),
        OpenApiParameter("department", int, description="The student's department"),
        OpenApiParameter("search", str, description="Student name or matric number"),
    ]
)
class RegistrationFormViewSet(DepartmentScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasRole(*MANAGERS)]
    pagination_class = PagePagination
    department_lookup = "student__program__department"
    queryset = SemesterRegistration.objects.select_related(*FORM_RELATIONS)

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .annotate(
                total_units=Coalesce(Sum("course_registrations__offering__course__units"), 0),
                course_count=Count("course_registrations"),
            )
        )

    def get_serializer_class(self):
        return FormSummarySerializer if self.action == "list" else FormDetailSerializer

    def filter_queryset(self, queryset):
        params = self.request.query_params
        filters = (
            ("semester", "semester"),
            ("level", "student__level"),
            ("program", "student__program"),
            ("department", "student__program__department"),
        )
        for name, lookup in filters:
            value = int_param(self.request, name)
            if value is not None:
                queryset = queryset.filter(**{lookup: value})
        status = params.get("status")
        if status:
            if status not in SemesterRegistration.Status.values:
                raise ValidationError({"status": f"Must be one of {', '.join(SemesterRegistration.Status.values)}."})
            queryset = queryset.filter(status=status)
        for word in params.get("search", "").split():
            queryset = queryset.filter(
                Q(student__matric_no__icontains=word)
                | Q(student__user__first_name__icontains=word)
                | Q(student__user__last_name__icontains=word)
            )
        awaiting_first = Case(
            When(status=SemesterRegistration.Status.SUBMITTED, then=Value(0)), default=Value(1), output_field=IntegerField()
        )
        return queryset.order_by(awaiting_first, "-submitted_at", "pk")

    @extend_schema(summary="Accept a submitted registration", request=None, responses=FormDetailSerializer)
    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        return Response(FormDetailSerializer(validate_registration(self.get_object(), request.user, request)).data)

    @extend_schema(summary="Send a registration back to the student", request=ReturnRegistrationSerializer, responses=FormDetailSerializer)
    @action(detail=True, methods=["post"], url_path="return", url_name="return")
    def return_form(self, request, pk=None):
        serializer = ReturnRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        form = return_registration(self.get_object(), request.user, serializer.validated_data["reason"], request)
        return Response(FormDetailSerializer(form).data)


@extend_schema(
    parameters=[
        OpenApiParameter("offering", int),
        OpenApiParameter("semester", int),
        OpenApiParameter("status", str, enum=SemesterRegistration.Status.values),
    ]
)
class CourseRegistrationViewSet(DepartmentScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [HasRole(*MANAGERS)]
    pagination_class = PagePagination
    # the department that owns a course sees everyone on it, whichever department they're from
    department_lookup = "offering__course__department"
    serializer_class = CourseRegistrationSerializer
    queryset = CourseRegistration.objects.select_related(
        "student__user",
        "student__program__department__faculty",
        "offering__course",
        "offering__semester__session",
        "semester_registration",
    ).order_by("offering__course__code", "student__matric_no")

    def list(self, request, *args, **kwargs):
        offering_id = int_param(request, "offering")
        if offering_id is not None:
            offerings = CourseOffering.objects.filter(pk=offering_id)
            scope = department_scope(request.user)
            if scope is not None:
                offerings = offerings.filter(course__department=scope)
            # another department's course 404s, as an out-of-scope object would
            if not offerings.exists():
                raise Http404
        return super().list(request, *args, **kwargs)

    def filter_queryset(self, queryset):
        for name, lookup in (("offering", "offering"), ("semester", "offering__semester")):
            value = int_param(self.request, name)
            if value is not None:
                queryset = queryset.filter(**{lookup: value})
        status = self.request.query_params.get("status")
        if status:
            queryset = queryset.filter(semester_registration__status=status)
        return queryset
