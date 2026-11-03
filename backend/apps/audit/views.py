from datetime import date

from django.db.models import Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.permissions import IsSuperAdmin
from core.viewsets import PagePagination

from .models import AuditLog
from .serializers import AuditDetailSerializer, AuditRowSerializer


def date_param(request, name):
    value = request.query_params.get(name)
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise ValidationError({name: "Use the format YYYY-MM-DD."}) from error


def number_param(request, name):
    value = request.query_params.get(name)
    if not value:
        return None
    if not value.isdigit():
        raise ValidationError({name: "Must be a whole number."})
    return int(value)


@extend_schema(
    parameters=[
        OpenApiParameter("actor", int),
        OpenApiParameter("action", str),
        OpenApiParameter("entity_type", str),
        OpenApiParameter("department", int),
        OpenApiParameter("date_from", str, description="YYYY-MM-DD"),
        OpenApiParameter("date_to", str, description="YYYY-MM-DD"),
        OpenApiParameter("search", str, description="Target or details"),
    ]
)
class AuditLogViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsSuperAdmin]
    pagination_class = PagePagination
    queryset = AuditLog.objects.select_related("actor", "department").order_by("-created_at", "-pk")

    def get_serializer_class(self):
        return AuditDetailSerializer if self.action == "retrieve" else AuditRowSerializer

    def filter_queryset(self, queryset):
        request = self.request
        if self.action != "list":
            return queryset
        for name, lookup in (("actor", "actor_id"), ("department", "department_id")):
            value = number_param(request, name)
            if value is not None:
                queryset = queryset.filter(**{lookup: value})
        for name in ("action", "entity_type"):
            value = request.query_params.get(name)
            if value:
                queryset = queryset.filter(**{name: value})
        start, end = date_param(request, "date_from"), date_param(request, "date_to")
        if start:
            queryset = queryset.filter(created_at__date__gte=start)
        if end:
            queryset = queryset.filter(created_at__date__lte=end)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(target__icontains=search) | Q(details__icontains=search))
        return queryset

    @extend_schema(summary="The values the log can be filtered by", responses={200: None})
    @action(detail=False, methods=["get"])
    def filters(self, request):
        actors = (
            AuditLog.objects.filter(actor__isnull=False)
            .order_by("actor__last_name", "actor__first_name")
            .values("actor_id", "actor__first_name", "actor__last_name", "actor__email")
            .distinct()
        )
        return Response(
            {
                "actions": list(AuditLog.objects.order_by("action").values_list("action", flat=True).distinct()),
                "entity_types": list(AuditLog.objects.order_by("entity_type").values_list("entity_type", flat=True).distinct()),
                "actors": [
                    {
                        "id": row["actor_id"],
                        "name": f"{row['actor__first_name']} {row['actor__last_name']}".strip() or row["actor__email"],
                    }
                    for row in actors
                ],
            }
        )
