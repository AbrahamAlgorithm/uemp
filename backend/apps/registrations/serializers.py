from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.academics.models import Semester
from apps.accounts.models import StudentProfile
from apps.accounts.serializers import SessionRefSerializer

from .models import CourseRegistration, SemesterRegistration
from .services import carry_over_course_ids


class SubmitRegistrationSerializer(serializers.Serializer):
    offering_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)


class ReturnRegistrationSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class SemesterBriefSerializer(serializers.ModelSerializer):
    session = SessionRefSerializer()

    class Meta:
        model = Semester
        fields = ["id", "term", "session", "is_current", "registration_open"]


class PersonRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


def person(user):
    return {"id": user.pk, "name": user.get_full_name() or user.email} if user else None


class FormStatusSerializer(serializers.ModelSerializer):
    validated_by = serializers.SerializerMethodField()

    class Meta:
        model = SemesterRegistration
        fields = ["id", "status", "submitted_at", "return_reason", "validated_by", "validated_at"]

    @extend_schema_field(PersonRefSerializer(allow_null=True))
    def get_validated_by(self, form):
        return person(form.validated_by)


class CourseOptionSerializer(serializers.Serializer):
    offering_id = serializers.IntegerField()
    code = serializers.CharField()
    title = serializers.CharField()
    units = serializers.IntegerField()
    level = serializers.IntegerField()
    lecturer = serializers.CharField(allow_null=True)
    is_carry_over = serializers.BooleanField()
    is_selected = serializers.BooleanField()


class RegistrationOverviewSerializer(serializers.Serializer):
    semester = SemesterBriefSerializer()
    registration_open = serializers.BooleanField()
    max_units = serializers.IntegerField()
    registration = FormStatusSerializer(allow_null=True)
    courses = CourseOptionSerializer(many=True)


class StudentBriefSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.get_full_name")
    email = serializers.EmailField(source="user.email")
    program = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = ["id", "name", "email", "matric_no", "level", "program", "department"]

    def get_program(self, student) -> dict:
        return {"id": student.program_id, "name": student.program.name, "award": student.program.award}

    def get_department(self, student) -> dict:
        department = student.program.department
        return {"id": department.id, "name": department.name, "code": department.code}


class CourseLineSerializer(serializers.Serializer):
    offering_id = serializers.IntegerField()
    code = serializers.CharField()
    title = serializers.CharField()
    units = serializers.IntegerField()
    level = serializers.IntegerField()
    lecturer = serializers.CharField(allow_null=True)
    is_carry_over = serializers.BooleanField()


def course_line(offering, is_carry_over):
    lecturer = offering.lecturer.user.get_full_name() if offering.lecturer else None
    return {
        "offering_id": offering.pk,
        "code": offering.course.code,
        "title": offering.course.title,
        "units": offering.course.units,
        "level": offering.course.level,
        "lecturer": lecturer,
        "is_carry_over": is_carry_over,
    }


class FormDetailSerializer(serializers.ModelSerializer):
    student = StudentBriefSerializer()
    semester = SemesterBriefSerializer()
    validated_by = serializers.SerializerMethodField()
    courses = serializers.SerializerMethodField()
    total_units = serializers.SerializerMethodField()

    class Meta:
        model = SemesterRegistration
        fields = [
            "id", "student", "semester", "status", "submitted_at", "validated_by", "validated_at",
            "return_reason", "total_units", "courses",
        ]

    def _lines(self, form):
        if not hasattr(form, "course_lines"):
            carry_overs = carry_over_course_ids(form.student, form.semester)
            registrations = form.course_registrations.select_related("offering__course", "offering__lecturer__user")
            form.course_lines = sorted(
                (course_line(r.offering, r.offering.course_id in carry_overs) for r in registrations),
                key=lambda line: line["code"],
            )
        return form.course_lines

    @extend_schema_field(PersonRefSerializer(allow_null=True))
    def get_validated_by(self, form):
        return person(form.validated_by)

    @extend_schema_field(CourseLineSerializer(many=True))
    def get_courses(self, form):
        return self._lines(form)

    def get_total_units(self, form) -> int:
        return sum(line["units"] for line in self._lines(form))


class FormSummarySerializer(serializers.ModelSerializer):
    student = StudentBriefSerializer()
    semester = SemesterBriefSerializer()
    total_units = serializers.IntegerField()
    course_count = serializers.IntegerField()

    class Meta:
        model = SemesterRegistration
        fields = ["id", "student", "semester", "status", "submitted_at", "validated_at", "total_units", "course_count"]


class RegisteredOfferingSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    title = serializers.CharField()
    units = serializers.IntegerField()
    semester = SemesterBriefSerializer()


class CourseRegistrationSerializer(serializers.ModelSerializer):
    student = StudentBriefSerializer()
    offering = serializers.SerializerMethodField()
    form_id = serializers.IntegerField(source="semester_registration_id")
    form_status = serializers.CharField(source="semester_registration.status")
    registered_at = serializers.DateTimeField(source="created_at")

    class Meta:
        model = CourseRegistration
        fields = ["id", "student", "offering", "form_id", "form_status", "registered_at"]

    @extend_schema_field(RegisteredOfferingSerializer)
    def get_offering(self, registration):
        offering = registration.offering
        return {
            "id": offering.pk,
            "code": offering.course.code,
            "title": offering.course.title,
            "units": offering.course.units,
            "semester": SemesterBriefSerializer(offering.semester).data,
        }
