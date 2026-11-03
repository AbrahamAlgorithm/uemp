from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit import services as audit
from apps.audit.services import snapshot
from core.permissions import MANAGERS, HasRole, IsSuperAdmin
from core.scoping import DepartmentScopedQuerysetMixin


class PagePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


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
            audit.record(self.request.user, "CREATE", instance, after=snapshot(instance), request=self.request)

    def perform_update(self, serializer):
        instance = self.get_object()
        before = snapshot(instance)
        with transaction.atomic():
            instance = serializer.save()
            audit.record(self.request.user, "UPDATE", instance, before=before, after=snapshot(instance), request=self.request)


class SuperAdminViewSet(BaseViewSet):
    permission_classes = [IsSuperAdmin]


class ScopedViewSet(DepartmentScopedQuerysetMixin, BaseViewSet):
    permission_classes = [HasRole(*MANAGERS)]

    def filter_queryset(self, queryset):
        return apply_query_filters(queryset, self.request, self.search_fields, self.filter_fields)
