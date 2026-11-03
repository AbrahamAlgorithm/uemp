from django.conf import settings
from rest_framework_simplejwt.settings import api_settings

ACCESS_COOKIE = "uemp_access"
REFRESH_COOKIE = "uemp_refresh"
ROLE_COOKIE = "uemp_role"
REFRESH_PATH = "/api/auth/"


def _cookie_options():
    return {"secure": settings.AUTH_COOKIE_SECURE, "samesite": "Lax"}


def set_auth_cookies(response, refresh, role):
    access_age = int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds())
    refresh_age = int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds())
    options = _cookie_options()
    response.set_cookie(ACCESS_COOKIE, str(refresh.access_token), max_age=access_age, httponly=True, **options)
    response.set_cookie(
        REFRESH_COOKIE, str(refresh), max_age=refresh_age, path=REFRESH_PATH, httponly=True, **options
    )
    # readable by the frontend for redirects only, the server never trusts it
    response.set_cookie(ROLE_COOKIE, role, max_age=refresh_age, **options)


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, samesite="Lax")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_PATH, samesite="Lax")
    response.delete_cookie(ROLE_COOKIE, samesite="Lax")
