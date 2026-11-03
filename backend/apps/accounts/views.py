from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import Http404
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied, Throttled, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.academics.models import Department
from apps.audit import services as audit
from apps.audit.services import snapshot
from core.permissions import INACTIVE_ACCOUNT, MANAGERS, HasRole
from core.scoping import department_scope
from core.viewsets import ScopedViewSet, SuperAdminViewSet, apply_query_filters

from .authentication import AUTH_HEADER, enforce_csrf
from .cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from .models import StaffProfile, StudentProfile, User
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    MeSerializer,
    StaffSerializer,
    StudentSerializer,
    UserSerializer,
)
from .services import FailedLogins, can_sign_in, find_user, identifier_of, me_queryset

INVALID_CREDENTIALS = "Invalid credentials."
TOO_MANY_FAILURES = "Too many failed attempts. Try again in a minute."
SESSION_ENDED = "Your session has ended. Sign in again."


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class PublicAuthView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    # without an authenticator DRF would turn every 401 here into a 403
    def get_authenticate_header(self, request):
        return AUTH_HEADER


def refresh_from_cookie(request):
    raw = request.COOKIES.get(REFRESH_COOKIE)
    if not raw:
        return None, None
    try:
        token = RefreshToken(raw)
        user = User.objects.get(pk=token[api_settings.USER_ID_CLAIM])
    except (TokenError, KeyError, User.DoesNotExist):
        return None, None
    return token, user


def signed_out(detail):
    response = Response({"detail": detail}, status=status.HTTP_401_UNAUTHORIZED)
    clear_auth_cookies(response)
    return response


class CsrfView(PublicAuthView):
    @extend_schema(summary="Set the CSRF cookie", responses={204: None})
    def get(self, request):
        get_token(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class LoginView(PublicAuthView):
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        summary="Sign in with an email, matric number or staff ID",
        request=LoginSerializer,
        responses={
            200: MeSerializer,
            401: OpenApiResponse(description=INVALID_CREDENTIALS),
            403: OpenApiResponse(description=INACTIVE_ACCOUNT),
            429: OpenApiResponse(description="5 failed attempts on one account, or 30 attempts from one IP, in a minute"),
        },
    )
    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            raise AuthenticationFailed(INVALID_CREDENTIALS)
        identifier = serializer.validated_data["identifier"]
        password = serializer.validated_data["password"]
        user = find_user(identifier)
        failures = FailedLogins(user, identifier)
        # checked before the password, otherwise guessing could go on until it hit the right one
        if failures.blocked():
            raise Throttled(detail=TOO_MANY_FAILURES)
        if user is None:
            # hash anyway so an unknown identifier takes as long as a wrong password
            make_password(password)
            failures.add()
            raise AuthenticationFailed(INVALID_CREDENTIALS)
        if not user.check_password(password):
            failures.add()
            raise AuthenticationFailed(INVALID_CREDENTIALS)
        failures.clear()
        if not can_sign_in(user):
            raise PermissionDenied(INACTIVE_ACCOUNT)

        with transaction.atomic():
            user.last_login = timezone.now()
            user.save(update_fields=["last_login"])
            audit.record(user, "LOGIN", user, request=request, target=identifier_of(user), details="Signed in")

        response = Response(MeSerializer(me_queryset().get(pk=user.pk)).data)
        set_auth_cookies(response, RefreshToken.for_user(user), user.role)
        return response


class RefreshView(PublicAuthView):
    @extend_schema(
        summary="Rotate the auth cookies using the refresh cookie",
        request=None,
        responses={204: None, 401: OpenApiResponse(description=SESSION_ENDED)},
    )
    def post(self, request):
        enforce_csrf(request)
        token, user = refresh_from_cookie(request)
        if token is None:
            return signed_out(SESSION_ENDED)
        if not can_sign_in(user):
            return signed_out(INACTIVE_ACCOUNT)
        token.blacklist()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        set_auth_cookies(response, RefreshToken.for_user(user), user.role)
        return response


class LogoutView(PublicAuthView):
    @extend_schema(summary="Sign out and revoke the refresh token", request=None, responses={204: None})
    def post(self, request):
        enforce_csrf(request)
        token, user = refresh_from_cookie(request)
        if token is not None:
            with transaction.atomic():
                token.blacklist()
                audit.record(user, "LOGOUT", user, request=request, target=identifier_of(user), details="Signed out")
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class MeView(APIView):
    @extend_schema(summary="The signed-in user", responses=MeSerializer)
    def get(self, request):
        return Response(MeSerializer(me_queryset().get(pk=request.user.pk)).data)


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
