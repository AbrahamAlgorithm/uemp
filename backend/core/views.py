import logging

from django.db import DatabaseError, connection
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
