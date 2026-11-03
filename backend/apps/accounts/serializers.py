import re
from datetime import date

from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field
from rest_framework import serializers

from apps.academics.models import AcademicSession, Department, Faculty, Program
from apps.audit.models import AuditLog
from apps.audit.serializers import ROUTINE_ACTIONS

from .models import StaffProfile, StudentProfile, User


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=254)
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class FacultyRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ["id", "name", "code"]


class DepartmentRefSerializer(serializers.ModelSerializer):
    faculty = FacultyRefSerializer()

    class Meta:
        model = Department
        fields = ["id", "name", "code", "faculty"]


class ProgramRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = ["id", "name", "award"]


class SessionRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicSession
        fields = ["id", "name"]


class StudentProfileSerializer(serializers.ModelSerializer):
    program = ProgramRefSerializer()
    entry_session = SessionRefSerializer(allow_null=True)

    class Meta:
        model = StudentProfile
        fields = ["matric_no", "level", "gender", "date_of_birth", "entry_session", "program", "phone", "address"]


class StaffProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffProfile
        fields = ["staff_id", "title", "phone"]


class MeSerializer(serializers.ModelSerializer):
    department = DepartmentRefSerializer(allow_null=True)
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "role", "status", "department", "profile"]

    @extend_schema_field(
        PolymorphicProxySerializer(
            component_name="Profile",
            serializers=[StudentProfileSerializer, StaffProfileSerializer],
            resource_type_field_name=None,
            allow_null=True,
        )
    )
    def get_profile(self, user):
        student = getattr(user, "student_profile", None)
        if student is not None:
            return StudentProfileSerializer(student).data
        staff = getattr(user, "staff_profile", None)
        return StaffProfileSerializer(staff).data if staff is not None else None


class UserSerializer(serializers.ModelSerializer):
    department_detail = serializers.SerializerMethodField(source="department", read_only=True)
    identifier = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    student = serializers.SerializerMethodField()
    staff = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "role", "status", "department",
            "department_detail", "identifier", "phone", "date_joined", "last_login",
            "student", "staff", "recent_activity",
        ]
        read_only_fields = ["email", "date_joined", "last_login", "identifier", "phone"]

    def get_department_detail(self, obj) -> dict | None:
        if not obj.department:
            return None
        return {"id": obj.department_id, "name": obj.department.name, "code": obj.department.code}

    def get_identifier(self, obj) -> str | None:
        profile = getattr(obj, "student_profile", None) or getattr(obj, "staff_profile", None)
        return getattr(profile, "matric_no", None) or getattr(profile, "staff_id", None)

    def get_phone(self, obj) -> str:
        return getattr(getattr(obj, "student_profile", None), "phone", None) or getattr(
            getattr(obj, "staff_profile", None), "phone", ""
        )

    def get_student(self, obj) -> dict | None:
        profile = getattr(obj, "student_profile", None)
        return StudentSerializer(profile).data if profile else None

    def get_staff(self, obj) -> dict | None:
        profile = getattr(obj, "staff_profile", None)
        return StaffSerializer(profile).data if profile else None

    def get_recent_activity(self, obj) -> list[dict]:
        return [
            {"id": entry.id, "at": entry.created_at, "action": entry.action, "target": entry.target, "details": entry.details}
            for entry in AuditLog.objects.filter(actor=obj).exclude(action__in=ROUTINE_ACTIONS).order_by("-created_at")[:10]
        ]

    def validate(self, attrs):
        role = attrs.get("role", self.instance.role if self.instance else None)
        department = attrs.get("department", self.instance.department if self.instance else None)
        if role == User.Role.SUPER_ADMIN and department is not None:
            raise serializers.ValidationError({"department": "Super admins cannot belong to a department."})
        if role != User.Role.SUPER_ADMIN and department is None:
            raise serializers.ValidationError({"department": "A department is required for this role."})
        return attrs


class StudentSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    status = serializers.CharField(source="user.status", read_only=True)
    department = serializers.SerializerMethodField()
    faculty = serializers.SerializerMethodField()
    program_detail = serializers.SerializerMethodField(source="program", read_only=True)
    entry_session_detail = serializers.SerializerMethodField()
    initial_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StudentProfile
        fields = [
            "id", "email", "first_name", "last_name", "matric_no", "level", "gender",
            "date_of_birth", "entry_session", "entry_session_detail", "phone", "address", "status", "program",
            "program_detail", "department", "faculty", "initial_password",
        ]

    def get_department(self, obj) -> dict:
        d = obj.program.department
        return {"id": d.id, "name": d.name, "code": d.code}

    def get_faculty(self, obj) -> dict:
        f = obj.program.department.faculty
        return {"id": f.id, "name": f.name, "code": f.code}

    def get_program_detail(self, obj) -> dict:
        return {"id": obj.program_id, "name": obj.program.name, "award": obj.program.award}

    def get_entry_session_detail(self, obj) -> dict | None:
        return {"id": obj.entry_session_id, "name": obj.entry_session.name} if obj.entry_session_id else None

    def validate_initial_password(self, value):
        validate_password(value)
        return value


class StaffSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email")
    first_name = serializers.CharField(source="user.first_name")
    last_name = serializers.CharField(source="user.last_name")
    role = serializers.CharField(source="user.role", required=False, default=User.Role.LECTURER)
    status = serializers.CharField(source="user.status", read_only=True)
    department = serializers.SerializerMethodField()
    faculty = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(read_only=True)
    current_offerings = serializers.SerializerMethodField()
    total_units = serializers.SerializerMethodField()
    initial_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StaffProfile
        fields = [
            "id", "user_id", "email", "first_name", "last_name", "staff_id", "title", "phone",
            "role", "status", "department", "faculty", "current_offerings", "total_units", "initial_password",
        ]

    def _offerings(self, obj):
        # the list view prefetches these; a create or update response reads them on demand
        if not hasattr(obj, "current_offering_rows"):
            obj.current_offering_rows = list(obj.offerings.filter(semester__is_current=True).select_related("course"))
        return obj.current_offering_rows

    def get_current_offerings(self, obj) -> list[dict]:
        return [
            {"id": offering.pk, "code": offering.course.code, "title": offering.course.title, "units": offering.course.units}
            for offering in sorted(self._offerings(obj), key=lambda offering: offering.course.code)
        ]

    def get_total_units(self, obj) -> int:
        return sum(offering.course.units for offering in self._offerings(obj))

    def get_department(self, obj) -> dict | None:
        d = obj.user.department
        return {"id": d.id, "name": d.name, "code": d.code} if d else None

    def get_faculty(self, obj) -> dict | None:
        d = obj.user.department
        f = d.faculty if d else None
        return {"id": f.id, "name": f.name, "code": f.code} if f else None

    def validate_initial_password(self, value):
        validate_password(value)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value


PHONE_PATTERN = re.compile(r"^(\+234|0)[789][01]\d{8}$")
MINIMUM_AGE = 14


def years_between(born, today):
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


class ProfileUpdateSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    address = serializers.CharField(max_length=255, allow_blank=True)
    date_of_birth = serializers.DateField()

    def validate_phone(self, value):
        phone = re.sub(r"\s+", "", value)
        if not PHONE_PATTERN.match(phone):
            raise serializers.ValidationError("Enter a valid Nigerian phone number, e.g. 08031234567.")
        return phone

    def validate_address(self, value):
        return value.strip()

    def validate_date_of_birth(self, value: date):
        today = timezone.localdate()
        if value >= today:
            raise serializers.ValidationError("Date of birth must be in the past.")
        if years_between(value, today) < MINIMUM_AGE:
            raise serializers.ValidationError(f"You must be at least {MINIMUM_AGE} years old.")
        return value
