from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.middleware.csrf import get_token
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit import services as audit
from core.permissions import INACTIVE_ACCOUNT

from .authentication import AUTH_HEADER, enforce_csrf
from .cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from .models import User
from .serializers import LoginSerializer, MeSerializer
from .services import can_sign_in, find_user, identifier_of, me_queryset

INVALID_CREDENTIALS = "Invalid credentials."
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
            429: OpenApiResponse(description="More than 5 attempts in a minute"),
        },
    )
    def post(self, request):
        enforce_csrf(request)
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            raise AuthenticationFailed(INVALID_CREDENTIALS)
        password = serializer.validated_data["password"]
        user = find_user(serializer.validated_data["identifier"])
        if user is None:
            # hash anyway so an unknown identifier takes as long as a wrong password
            make_password(password)
            raise AuthenticationFailed(INVALID_CREDENTIALS)
        if not user.check_password(password):
            raise AuthenticationFailed(INVALID_CREDENTIALS)
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
