from django.conf import settings
from django.db import models
from django.db.models import F, Q

from core.models import TimeStampedModel


class GradeScale(TimeStampedModel):
    min_score = models.PositiveSmallIntegerField()
    max_score = models.PositiveSmallIntegerField()
    grade = models.CharField(max_length=2)
    point = models.DecimalField(max_digits=3, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(min_score__gte=0, max_score__lte=100, min_score__lte=F("max_score")),
                name="grade_scale_valid_range",
            ),
        ]

    def __str__(self):
        return f"{self.grade} ({self.min_score}-{self.max_score})"


class ResultSheet(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SUBMITTED = "SUBMITTED", "Submitted"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    offering = models.OneToOneField("courses.CourseOffering", on_delete=models.PROTECT, related_name="result_sheet")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="submitted_result_sheets",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_result_sheets",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    feedback = models.TextField(blank=True)

    def __str__(self):
        return f"{self.offering} [{self.status}]"


class ResultEntry(TimeStampedModel):
    registration = models.OneToOneField(
        "registrations.CourseRegistration",
        on_delete=models.PROTECT,
        related_name="result",
    )
    ca_score = models.DecimalField(max_digits=5, decimal_places=2)
    exam_score = models.DecimalField(max_digits=5, decimal_places=2)
    total = models.DecimalField(max_digits=5, decimal_places=2)
    grade = models.CharField(max_length=2)
    grade_point = models.DecimalField(max_digits=3, decimal_places=2)

    class Meta:
        verbose_name_plural = "result entries"
        constraints = [
            models.CheckConstraint(condition=Q(ca_score__gte=0, ca_score__lte=30), name="result_entry_ca_0_to_30"),
            models.CheckConstraint(
                condition=Q(exam_score__gte=0, exam_score__lte=70),
                name="result_entry_exam_0_to_70",
            ),
        ]

    def __str__(self):
        return f"{self.registration}: {self.total} {self.grade}"
