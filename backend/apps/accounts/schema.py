from drf_spectacular.extensions import OpenApiAuthenticationExtension

from .cookies import ACCESS_COOKIE


class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.CookieJWTAuthentication"
    name = "cookieAuth"
    # outranks drf-spectacular's own simplejwt extension, which matches subclasses too
    priority = 1

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "cookie",
            "name": ACCESS_COOKIE,
            "description": "Set by POST /api/auth/login/. The browser sends it automatically, "
            "so Try it out works once you have signed in on this page.",
        }
