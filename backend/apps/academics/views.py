from django.db import transaction
from django.http import Http404
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit import services as audit
from apps.audit.services import snapshot
from core.viewsets import ScopedViewSet, SuperAdminViewSet, apply_query_filters

from .models import AcademicSession, Department, Faculty, Program, Semester
from .serializers import DepartmentSerializer, FacultySerializer, ProgramSerializer, SemesterSerializer, SessionSerializer


class FacultyViewSet(SuperAdminViewSet):
    queryset = Faculty.objects.all().order_by("name")
    serializer_class = FacultySerializer
    search_fields = ("name", "code")
    protected_delete_message = "This faculty has departments; it cannot be deleted."

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields)


class DepartmentViewSet(SuperAdminViewSet):
    queryset = Department.objects.select_related("faculty").all().order_by("name")
    serializer_class = DepartmentSerializer
    search_fields = ("name", "code")
    protected_delete_message = "This department has courses and students; it cannot be deleted."

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields, ("faculty",))


class SessionViewSet(SuperAdminViewSet):
    queryset = AcademicSession.objects.all().order_by("-name")
    serializer_class = SessionSerializer
    search_fields = ("name",)

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields)


class SemesterViewSet(SuperAdminViewSet):
    queryset = Semester.objects.select_related("session").all().order_by("-session__name", "term")
    serializer_class = SemesterSerializer
    search_fields = ("session__name", "term")

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields, ("session",))

    def perform_update(self, serializer):
        semester = self.get_object()
        was_open = semester.registration_open
        before = snapshot(semester)
        with transaction.atomic():
            semester = serializer.save()
            if semester.registration_open == was_open:
                action_name = "UPDATE"
            elif semester.registration_open:
                action_name = "REGISTRATION_WINDOW_OPENED"
            else:
                action_name = "REGISTRATION_WINDOW_CLOSED"
            audit.record(self.request.user, action_name, semester, before=before, after=snapshot(semester), request=self.request)

    @action(detail=True, methods=["post"])
    def set_current(self, request, pk=None):
        with transaction.atomic():
            semester = Semester.objects.select_for_update().get(pk=self.get_object().pk)
            Semester.objects.filter(is_current=True).exclude(pk=semester.pk).update(is_current=False)
            before = snapshot(semester)
            semester.is_current = True
            semester.save(update_fields=["is_current", "updated_at"])
            audit.record(request.user, "SEMESTER_SET_CURRENT", semester, before=before, after=snapshot(semester), request=request)
        return Response(self.get_serializer(semester).data)


class ProgramViewSet(ScopedViewSet):
    queryset = Program.objects.select_related("department").all().order_by("name")
    serializer_class = ProgramSerializer
    department_lookup = "department"
    search_fields = ("name", "award")
    filter_fields = ("department",)


class CurrentSemesterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        semester = Semester.objects.select_related("session").filter(is_current=True).first()
        if not semester:
            raise Http404
        return Response(SemesterSerializer(semester).data)
