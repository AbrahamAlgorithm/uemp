import logging

from django.db import DatabaseError, connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# referenced by path in ENUM_NAME_OVERRIDES
HEALTH_STATES = ["ok", "error"]

HealthSerializer = inline_serializer(
    name="Health",
    fields={
        "status": serializers.ChoiceField(choices=HEALTH_STATES),
        "database": serializers.ChoiceField(choices=HEALTH_STATES),
    },
)


@extend_schema(responses={200: HealthSerializer, 503: HealthSerializer})
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        logger.exception("Health check: database query failed")
        return Response(
            {"status": "error", "database": "error"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({"status": "ok", "database": "ok"})


ENDPOINTS = [
    ("GET", "/api/docs/", "Swagger UI", "Interactive documentation; try the endpoints from the browser."),
    ("GET", "/api/schema/", "OpenAPI schema", "Machine-readable description of every endpoint."),
    ("GET", "/api/health/", "Health check", "Service and database status."),
    ("POST", "/api/auth/login/", "Sign in", "Send an identifier and password to start a session."),
]

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UEMP API</title>
<style>
body{{font:16px/1.55 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1.25rem;color:#1a1a1a}}
h1{{margin-bottom:.25rem}} p{{color:#555}} ul{{padding:0;list-style:none}}
li{{padding:.75rem 0;border-top:1px solid #e5e5e5}} code{{background:#f3f3f3;padding:.1rem .35rem;border-radius:4px}}
</style></head><body>
<h1>UEMP API</h1>
<p>University Education Management Portal. This address serves the API only; the web app is a separate service.</p>
<ul>{items}</ul>
</body></html>"""


@require_GET
def index(request):
    wants_page = "text/html" in request.headers.get("Accept", "")
    if wants_page:
        items = "".join(
            f"<li><code>{method} {path}</code><br>{name}: {description}</li>" if method != "GET"
            else f'<li><a href="{path}"><code>{method} {path}</code></a><br>{name}: {description}</li>'
            for method, path, name, description in ENDPOINTS
        )
        return HttpResponse(PAGE.format(items=items))
    return JsonResponse(
        {
            "service": "UEMP API",
            "endpoints": [
                {"method": method, "path": path, "url": request.build_absolute_uri(path), "name": name, "description": description}
                for method, path, name, description in ENDPOINTS
            ],
        }
    )
