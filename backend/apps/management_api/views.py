from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import AcademicSession, Department, Faculty, Program, Semester
from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.audit import services as audit
from apps.courses.models import Course, CourseOffering
from apps.results.models import GradeScale, ResultSheet
from core.permissions import HasRole, IsSuperAdmin
from core.scoping import DepartmentScopedQuerysetMixin, department_scope

from .serializers import (
    ChangePasswordSerializer,
    CourseSerializer,
    DepartmentSerializer,
    FacultySerializer,
    GradeScaleSerializer,
    OfferingSerializer,
    ProgramSerializer,
    SessionSerializer,
    SemesterSerializer,
    StaffSerializer,
    StudentSerializer,
    UserSerializer,
)

MANAGERS = (User.Role.DEPT_ADMIN, User.Role.SUPER_ADMIN)


class PagePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def snapshot(instance):
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        data[field.name] = value.isoformat() if hasattr(value, "isoformat") else value
    return data


def apply_query_filters(queryset, request, search_fields=(), filters=()):
    search = request.query_params.get("search")
    if search:
        query = Q()
        for field in search_fields:
            query |= Q(**{f"{field}__icontains": search})
        queryset = queryset.filter(query)
    for field in filters:
        value = request.query_params.get(field)
        if value not in (None, ""):
            queryset = queryset.filter(**{field: value})
    ordering = request.query_params.get("ordering")
    if ordering:
        allowed = {field.lstrip("-") for field in search_fields + tuple(filters)}
        fields = [field for field in ordering.split(",") if field.lstrip("-") in allowed]
        if fields:
            queryset = queryset.order_by(*fields)
    return queryset


class BaseViewSet(viewsets.ModelViewSet):
    pagination_class = PagePagination
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        before = snapshot(instance)
        try:
            with transaction.atomic():
                instance.delete()
                audit.record(request.user, "DELETE", instance, before=before, request=request)
        except IntegrityError:
            return Response(self.protected_delete_message, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @property
    def protected_delete_message(self):
        return "This record has related records and cannot be deleted."

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            audit.record(request_user := self.request.user, "CREATE", instance, after=snapshot(instance), request=self.request)

    def perform_update(self, serializer):
        instance = self.get_object()
        before = snapshot(instance)
        with transaction.atomic():
            instance = serializer.save()
            audit.record(self.request.user, "UPDATE", instance, before=before, after=snapshot(instance), request=self.request)


class SuperAdminViewSet(BaseViewSet):
    permission_classes = [IsSuperAdmin]


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


class ScopedViewSet(DepartmentScopedQuerysetMixin, BaseViewSet):
    permission_classes = [HasRole(*MANAGERS)]

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields, self.filter_fields)


class ProgramViewSet(ScopedViewSet):
    queryset = Program.objects.select_related("department").all().order_by("name")
    serializer_class = ProgramSerializer
    department_lookup = "department"
    search_fields = ("name", "award")
    filter_fields = ("department",)


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


class StudentViewSet(ScopedViewSet):
    queryset = StudentProfile.objects.select_related("user", "program__department__faculty", "entry_session").all().order_by("matric_no")
    serializer_class = StudentSerializer
    department_lookup = "program__department"
    search_fields = ("matric_no", "user__email", "user__first_name", "user__last_name")
    filter_fields = ("program", "level")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = serializer.validated_data["program"]
        if department_scope(request.user) is not None and program.department_id != request.user.department_id:
            raise Http404
        user_data = serializer.validated_data.pop("user")
        password = serializer.validated_data.pop("initial_password", None)
        if not password:
            raise ValidationError({"initial_password": "This field is required."})
        with transaction.atomic():
            user = User.objects.create_user(
                password=password,
                role=User.Role.STUDENT,
                department=program.department,
                email=user_data["email"],
                first_name=user_data.get("first_name", ""),
                last_name=user_data.get("last_name", ""),
            )
            student = StudentProfile.objects.create(user=user, **serializer.validated_data)
            audit.record(request.user, "CREATE", student, after=snapshot(student), request=request)
        return Response(self.get_serializer(student).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        profile = self.get_object()
        before = snapshot(profile)
        user_data = serializer.validated_data.pop("user", {})
        serializer.validated_data.pop("initial_password", None)
        program = serializer.validated_data.get("program", profile.program)
        if department_scope(self.request.user) is not None and program.department_id != self.request.user.department_id:
            raise Http404
        with transaction.atomic():
            if user_data:
                User.objects.filter(pk=profile.user_id).update(**user_data)
            profile = serializer.save()
            audit.record(self.request.user, "UPDATE", profile, before=before, after=snapshot(profile), request=self.request)


class StaffViewSet(ScopedViewSet):
    queryset = StaffProfile.objects.select_related("user__department__faculty").all().order_by("staff_id")
    serializer_class = StaffSerializer
    department_lookup = "user__department"
    search_fields = ("staff_id", "user__email", "user__first_name", "user__last_name")
    filter_fields = ("user__role",)

    def filter_queryset(self, queryset):
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(user__role=role)
        return apply_query_filters(queryset, self.request, self.search_fields, self.filter_fields)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_data = data.pop("user")
        role = user_data.pop("role")
        department = request.user.department if request.user.role == User.Role.DEPT_ADMIN else request.data.get("department")
        if request.user.role == User.Role.DEPT_ADMIN and role != User.Role.LECTURER:
            raise PermissionDenied("Department admins can only create lecturers.")
        if request.user.role == User.Role.SUPER_ADMIN:
            department = Department.objects.filter(pk=department).first() if department else None
            if role != User.Role.SUPER_ADMIN and department is None:
                raise ValidationError({"department": "A department is required for this role."})
            if role == User.Role.SUPER_ADMIN:
                department = None
        password = data.pop("initial_password", None)
        if not password:
            raise ValidationError({"initial_password": "This field is required."})
        with transaction.atomic():
            user = User.objects.create_user(password=password, role=role, department=department, **user_data)
            staff = StaffProfile.objects.create(user=user, **data)
            audit.record(request.user, "CREATE", staff, after=snapshot(staff), request=request)
        return Response(self.get_serializer(staff).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        profile = self.get_object()
        before = snapshot(profile)
        user_data = serializer.validated_data.pop("user", {})
        serializer.validated_data.pop("initial_password", None)
        with transaction.atomic():
            if user_data:
                User.objects.filter(pk=profile.user_id).update(**user_data)
            profile = serializer.save()
            audit.record(self.request.user, "UPDATE", profile, before=before, after=snapshot(profile), request=self.request)


class OfferingViewSet(ScopedViewSet):
    queryset = CourseOffering.objects.select_related("course__department", "semester", "lecturer__user", "result_sheet").all()
    serializer_class = OfferingSerializer
    department_lookup = "course__department"
    search_fields = ("course__code", "course__title")
    filter_fields = ("semester", "course", "lecturer")

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


class UserViewSet(SuperAdminViewSet):
    queryset = User.objects.select_related("department", "student_profile", "staff_profile").all().order_by("last_name", "first_name")
    serializer_class = UserSerializer
    search_fields = ("email", "first_name", "last_name")

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields, ("role", "status", "department"))

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk and ("role" in request.data or request.data.get("status") in [User.Status.SUSPENDED, User.Status.INACTIVE]):
            raise ValidationError({"detail": "You cannot demote or deactivate yourself."})
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        user = self.get_object()
        before = snapshot(user)
        changed_role = "role" in self.request.data or "department" in self.request.data
        changed_status = "status" in self.request.data
        with transaction.atomic():
            user = serializer.save()
            audit.record(
                self.request.user,
                "CHANGE_ROLE" if changed_role else "CHANGE_STATUS" if changed_status else "UPDATE",
                user,
                before=before,
                after=snapshot(user),
                request=self.request,
            )

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Users cannot be deleted."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def _status(self, request, user, value):
        if user.pk == request.user.pk and value != User.Status.ACTIVE:
            raise ValidationError({"detail": "You cannot suspend or deactivate yourself."})
        before = snapshot(user)
        with transaction.atomic():
            user.status = value
            user.save(update_fields=["status", "updated_at"])
            audit.record(request.user, "CHANGE_STATUS", user, before=before, after=snapshot(user), request=request)
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return self._status(request, self.get_object(), User.Status.ACTIVE)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        return self._status(request, self.get_object(), User.Status.INACTIVE)

    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        return self._status(request, self.get_object(), User.Status.SUSPENDED)

    @action(detail=True, methods=["post"], permission_classes=[HasRole(*MANAGERS)])
    def reset_password(self, request, pk=None):
        target = self.get_object()
        if request.user.role == User.Role.DEPT_ADMIN and (
            target.role not in (User.Role.STUDENT, User.Role.LECTURER)
            or target.department_id != request.user.department_id
        ):
            raise Http404
        password = request.data.get("new_password")
        if not password:
            raise ValidationError({"new_password": "This field is required."})
        try:
            validate_password(password, target)
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": list(exc.messages)})
        before = {"password_changed": False}
        with transaction.atomic():
            target.set_password(password)
            target.save(update_fields=["password", "updated_at"])
            audit.record(request.user, "PASSWORD_RESET", target, before=before, after={"password_changed": True}, request=request)
        return Response({"detail": "Password reset successfully."})


class CurrentSemesterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        semester = Semester.objects.select_related("session").filter(is_current=True).first()
        if not semester:
            raise Http404
        return Response(SemesterSerializer(semester).data)


class GradeScaleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(GradeScaleSerializer(GradeScale.objects.order_by("-min_score"), many=True).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["current_password"]):
            raise ValidationError({"current_password": "Current password is incorrect."})
        before = {"password_changed": False}
        with transaction.atomic():
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save(update_fields=["password", "updated_at"])
            audit.record(request.user, "PASSWORD_CHANGED", request.user, before=before, after={"password_changed": True}, request=request)
        return Response({"detail": "Password changed successfully."})
