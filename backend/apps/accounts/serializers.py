from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field
from rest_framework import serializers

from apps.academics.models import AcademicSession, Department, Faculty, Program

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
