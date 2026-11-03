from django.db import transaction
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.audit import services as audit
from apps.audit.services import snapshot
from apps.registrations.views import int_param
from apps.results.models import ResultSheet
from core.viewsets import ScopedViewSet

from .models import Course, CourseOffering
from .serializers import CourseSerializer, OfferingSerializer


class CourseViewSet(ScopedViewSet):
    queryset = Course.objects.select_related("department").prefetch_related("programs").all().order_by("code")
    serializer_class = CourseSerializer
    department_lookup = "department"
    search_fields = ("code", "title")
    filter_fields = ("department", "level", "semester_term", "programs")

    def perform_create(self, serializer):
        if self.request.user.role == User.Role.DEPT_ADMIN:
            serializer.validated_data["department"] = self.request.user.department
        department = serializer.validated_data.get("department")
        if department is None:
            raise ValidationError({"department": "A department is required."})
        with transaction.atomic():
            course = serializer.save()
            audit.record(self.request.user, "CREATE", course, after=snapshot(course), request=self.request)

    def perform_update(self, serializer):
        if self.request.user.role == User.Role.DEPT_ADMIN:
            serializer.validated_data["department"] = self.request.user.department
        super().perform_update(serializer)


class OfferingViewSet(ScopedViewSet):
    queryset = CourseOffering.objects.select_related("course__department", "semester", "lecturer__user", "result_sheet").order_by("-semester__session__name", "-semester__term", "course__code")
    serializer_class = OfferingSerializer
    department_lookup = "course__department"
    search_fields = ("course__code", "course__title")
    filter_fields = ("course", "lecturer")

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if params.get("semester") == "current":
            queryset = queryset.filter(semester__is_current=True)
        else:
            semester = int_param(self.request, "semester")
            if semester is not None:
                queryset = queryset.filter(semester=semester)
        if params.get("unallocated") == "true":
            queryset = queryset.filter(lecturer__isnull=True)
        return super().filter_queryset(queryset)

    def _validate_lecturer(self, course, lecturer):
        if lecturer and (lecturer.user.role != User.Role.LECTURER or lecturer.user.department_id != course.department_id):
            raise ValidationError({"lecturer": "The lecturer must belong to the course department."})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course = serializer.validated_data["course"]
        self._validate_lecturer(course, serializer.validated_data.get("lecturer"))
        with transaction.atomic():
            offering = serializer.save()
            audit.record(request.user, "OFFERING_CREATED", offering, after=snapshot(offering), request=request)
            if offering.lecturer:
                audit.record(request.user, "LECTURER_ASSIGNED", offering, after=snapshot(offering), request=request)
        return Response(self.get_serializer(offering).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        offering = self.get_object()
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(offering, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        new_lecturer = serializer.validated_data.get("lecturer", offering.lecturer)
        self._validate_lecturer(offering.course, new_lecturer)
        if new_lecturer != offering.lecturer and offering.result_sheet.status != ResultSheet.Status.DRAFT:
            return Response(
                {"detail": "Results for this course have been submitted; the lecturer can't be changed."},
                status=status.HTTP_409_CONFLICT,
            )
        lecturer_changed = new_lecturer != offering.lecturer
        before = snapshot(offering)
        with transaction.atomic():
            offering = serializer.save()
            audit.record(self.request.user, "UPDATE", offering, before=before, after=snapshot(offering), request=self.request)
            if lecturer_changed:
                audit.record(self.request.user, "LECTURER_ASSIGNED", offering, before=before, after=snapshot(offering), request=self.request)
        return Response(self.get_serializer(offering).data)
