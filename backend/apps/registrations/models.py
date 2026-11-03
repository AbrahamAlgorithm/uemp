from django.db import models

from core.models import TimeStampedModel


class CourseRegistration(TimeStampedModel):
    student = models.ForeignKey("accounts.StudentProfile", on_delete=models.PROTECT, related_name="registrations")
    offering = models.ForeignKey("courses.CourseOffering", on_delete=models.PROTECT, related_name="registrations")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "offering"], name="course_registration_unique"),
        ]

    def __str__(self):
        return f"{self.student} - {self.offering}"
