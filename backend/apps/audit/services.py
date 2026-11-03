import ipaddress

from django.db import transaction
from rest_framework.throttling import BaseThrottle

from apps.academics.models import Department

from .models import AuditLog


def client_ip(request):
    # same rule as the login throttle (NUM_PROXIES), so both agree on who the client is
    ident = BaseThrottle().get_ident(request)
    try:
        return str(ipaddress.ip_address(ident))
    except (TypeError, ValueError):
        return None


def snapshot(instance):
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        data[field.name] = value.isoformat() if hasattr(value, "isoformat") else value
    return data


def department_of(entity, actor):
    if isinstance(entity, Department):
        return entity
    department = getattr(entity, "department", None)
    if isinstance(department, Department):
        return department
    return getattr(actor, "department", None)


def record(actor, action, entity, before=None, after=None, request=None, target="", details=""):
    """Write an audit entry inside the transaction.atomic() block of the change it records."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("audit.record() must run inside the transaction of the change it records")
    return AuditLog.objects.create(
        actor=actor,
        actor_email=getattr(actor, "email", ""),
        action=action,
        entity_type=entity._meta.label_lower,
        entity_id=str(entity.pk),
        target=target,
        details=details,
        department=department_of(entity, actor),
        before=before,
        after=after,
        ip_address=client_ip(request) if request is not None else None,
    )
