from rest_framework import serializers

from .models import AuditLog


class AuditActorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()


class AuditDepartmentSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()


class AuditRowSerializer(serializers.ModelSerializer):
    at = serializers.DateTimeField(source="created_at")
    actor = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "at", "actor", "actor_email", "action", "entity_type", "entity_id", "target", "details",
            "department", "ip_address",
        ]

    def get_actor(self, entry) -> dict | None:
        actor = entry.actor
        if actor is None:
            return None
        return {"id": actor.pk, "name": actor.get_full_name() or actor.email, "email": actor.email, "role": actor.role}

    def get_department(self, entry) -> dict | None:
        department = entry.department
        return {"id": department.pk, "code": department.code, "name": department.name} if department else None


class AuditDetailSerializer(AuditRowSerializer):
    class Meta(AuditRowSerializer.Meta):
        fields = [*AuditRowSerializer.Meta.fields, "before", "after"]


# routine events an activity feed leaves out; the audit log still records them
ROUTINE_ACTIONS = ("LOGIN", "LOGOUT", "PROFILE_UPDATED", "PASSWORD_CHANGED", "SCORES_SAVED")


def feed(queryset):
    return queryset.exclude(action__in=ROUTINE_ACTIONS).select_related("actor", "department").order_by("-created_at", "-pk")


def recent_rows(queryset, limit=3):
    return AuditRowSerializer(feed(queryset)[:limit], many=True).data
