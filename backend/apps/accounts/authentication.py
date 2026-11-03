from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.permissions import INACTIVE_ACCOUNT

from .cookies import ACCESS_COOKIE
from .models import User

AUTH_HEADER = 'Cookie realm="api"'


def enforce_csrf(request):
    # the browser attaches auth cookies on its own, so this is the same check SessionAuthentication runs
    check = CSRFCheck(lambda request: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get(ACCESS_COOKIE)
        if not raw_token:
            return None
        token = self.get_validated_token(raw_token)
        user = self.get_user(token)
        # checked on every request so a suspension applies before the access token expires
        if user.status != User.Status.ACTIVE:
            raise exceptions.AuthenticationFailed(INACTIVE_ACCOUNT, code="account_inactive")
        enforce_csrf(request)
        return user, token

    def authenticate_header(self, request):
        return AUTH_HEADER
