from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q

from apps.academics.models import Level
from core.models import TimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.SUPER_ADMIN)
        if extra_fields["is_staff"] is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields["is_superuser"] is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser, TimeStampedModel):
    class Role(models.TextChoices):
        STUDENT = "STUDENT", "Student"
        LECTURER = "LECTURER", "Lecturer"
        DEPT_ADMIN = "DEPT_ADMIN", "Department admin"
        SUPER_ADMIN = "SUPER_ADMIN", "Super admin"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        SUSPENDED = "SUSPENDED", "Suspended"

    username = None
    email = models.EmailField("email address", unique=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta(AbstractUser.Meta):
        constraints = [
            models.CheckConstraint(
                condition=(Q(role="SUPER_ADMIN") & Q(department__isnull=True))
                | (~Q(role="SUPER_ADMIN") & Q(department__isnull=False)),
                name="user_department_null_only_for_super_admin",
            ),
        ]

    def __str__(self):
        return self.email


class StudentProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    matric_no = models.CharField(max_length=20, unique=True)
    program = models.ForeignKey("academics.Program", on_delete=models.PROTECT, related_name="students")
    level = models.PositiveSmallIntegerField(choices=Level.choices)
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(level__in=Level.values), name="student_profile_valid_level"),
        ]

    def __str__(self):
        return self.matric_no

    @property
    def department(self):
        return self.program.department


class LecturerProfile(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="lecturer_profile")
    staff_id = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=30, blank=True)

    def __str__(self):
        return f"{self.staff_id} {self.user.get_full_name()}".strip()
