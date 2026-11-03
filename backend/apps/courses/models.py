from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.academics.models import Level, Semester
from apps.accounts.models import User
from core.models import TimeStampedModel


class Course(TimeStampedModel):
    department = models.ForeignKey("academics.Department", on_delete=models.PROTECT, related_name="courses")
    code = models.CharField(max_length=10, unique=True)
    title = models.CharField(max_length=200)
    units = models.PositiveSmallIntegerField()
    level = models.PositiveSmallIntegerField(choices=Level.choices)
    semester_term = models.CharField(max_length=10, choices=Semester.Term.choices)
    programs = models.ManyToManyField("academics.Program", blank=True, related_name="courses")

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(units__gte=1, units__lte=6), name="course_units_1_to_6"),
            models.CheckConstraint(condition=Q(level__in=Level.values), name="course_valid_level"),
        ]

    def __str__(self):
        return f"{self.code} {self.title}"


def validate_lecturer(staff):
    if staff is not None and staff.user.role != User.Role.LECTURER:
        raise ValidationError({"lecturer": "Only lecturers can be assigned to teach a course."})


class CourseOffering(TimeStampedModel):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="offerings")
    semester = models.ForeignKey("academics.Semester", on_delete=models.PROTECT, related_name="offerings")
    # staff profiles also belong to admins, so the role is checked in validate_lecturer
    lecturer = models.ForeignKey(
        "accounts.StaffProfile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="offerings",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["course", "semester"], name="course_offering_unique_per_semester"),
        ]

    def __str__(self):
        return f"{self.course.code} ({self.semester})"

    def clean(self):
        validate_lecturer(self.lecturer)
