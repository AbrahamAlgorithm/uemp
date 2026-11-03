from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class SemesterRegistration(TimeStampedModel):
    class Status(models.TextChoices):
        SUBMITTED = "SUBMITTED", "Submitted"
        VALIDATED = "VALIDATED", "Validated"
        RETURNED = "RETURNED", "Returned"

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.PROTECT, related_name="registration_forms"
    )
    semester = models.ForeignKey("academics.Semester", on_delete=models.PROTECT, related_name="registration_forms")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED, db_index=True)
    submitted_at = models.DateTimeField()
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="validated_registrations",
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    return_reason = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "semester"], name="semester_registration_unique"),
        ]

    def __str__(self):
        return f"{self.student} {self.semester} [{self.status}]"

    @property
    def department(self):
        return self.student.department


class CourseRegistration(TimeStampedModel):
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.PROTECT, related_name="registrations")
    offering = models.ForeignKey("courses.CourseOffering", on_delete=models.PROTECT, related_name="registrations")
    # the service keeps student and semester in step with the form; the database can't check across tables
    semester_registration = models.ForeignKey(
        SemesterRegistration,
        on_delete=models.PROTECT,
        related_name="course_registrations",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "offering"], name="course_registration_unique"),
        ]

    def __str__(self):
        return f"{self.student} - {self.offering}"
