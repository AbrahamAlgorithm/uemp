from django.db import models
from django.db.models import Q

from core.models import TimeStampedModel


class Level(models.IntegerChoices):
    L100 = 100, "100 level"
    L200 = 200, "200 level"
    L300 = 300, "300 level"
    L400 = 400, "400 level"
    L500 = 500, "500 level"


class Faculty(TimeStampedModel):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=10, unique=True)

    class Meta:
        verbose_name_plural = "faculties"

    def __str__(self):
        return self.name


class Department(TimeStampedModel):
    faculty = models.ForeignKey(Faculty, on_delete=models.PROTECT, related_name="departments")
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return self.name


class Program(TimeStampedModel):
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="programs")
    name = models.CharField(max_length=150)
    duration_years = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["department", "name"], name="program_unique_name_per_department"),
            models.CheckConstraint(
                condition=Q(duration_years__gte=4, duration_years__lte=6),
                name="program_duration_years_4_to_6",
            ),
        ]

    def __str__(self):
        return self.name


class AcademicSession(TimeStampedModel):
    name = models.CharField(max_length=20, unique=True)

    def __str__(self):
        return self.name


class Semester(TimeStampedModel):
    class Term(models.TextChoices):
        FIRST = "FIRST", "First semester"
        SECOND = "SECOND", "Second semester"

    session = models.ForeignKey(AcademicSession, on_delete=models.PROTECT, related_name="semesters")
    term = models.CharField(max_length=10, choices=Term.choices)
    is_current = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["session", "term"], name="semester_unique_term_per_session"),
            models.UniqueConstraint(
                fields=["is_current"],
                condition=Q(is_current=True),
                name="semester_single_current",
            ),
        ]

    def __str__(self):
        return f"{self.session} {self.get_term_display()}"
