from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class AuditLog(TimeStampedModel):
    # append-only, so there is nothing to track
    updated_at = None

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    # still names the actor after their account is deleted
    actor_email = models.EmailField(blank=True)
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=64)
    target = models.CharField(max_length=200, blank=True)
    details = models.TextField(blank=True)
    # lets department admins see their own activity; logs must never block a delete
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["entity_type", "entity_id"], name="audit_log_entity_idx"),
            models.Index(fields=["created_at"], name="audit_log_created_at_idx"),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.entity_id}"
