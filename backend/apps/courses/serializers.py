from rest_framework import serializers

from apps.academics.models import Program
from apps.accounts.models import User

from .models import Course, CourseOffering


class CourseSerializer(serializers.ModelSerializer):
    department_detail = serializers.SerializerMethodField(source="department", read_only=True)
    semester = serializers.CharField(source="semester_term")
    programs = serializers.PrimaryKeyRelatedField(queryset=Program.objects.all(), many=True)
    program_details = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "code", "title", "units", "level", "semester", "department", "department_detail", "programs", "program_details"]

    def get_department_detail(self, obj):
        return {"id": obj.department_id, "name": obj.department.name, "code": obj.department.code}

    def get_program_details(self, obj):
        return [{"id": program.id, "name": program.name} for program in obj.programs.all()]


class OfferingSerializer(serializers.ModelSerializer):
    course_detail = serializers.SerializerMethodField(source="course", read_only=True)
    semester_detail = serializers.SerializerMethodField(source="semester", read_only=True)
    lecturer_detail = serializers.SerializerMethodField(source="lecturer", read_only=True)
    sheet_status = serializers.CharField(source="result_sheet.status", read_only=True)

    class Meta:
        model = CourseOffering
        fields = ["id", "course", "course_detail", "semester", "semester_detail", "lecturer", "lecturer_detail", "sheet_status"]

    def get_course_detail(self, obj):
        department = obj.course.department
        return {
            "id": obj.course_id,
            "code": obj.course.code,
            "title": obj.course.title,
            "department": {"id": department.id, "name": department.name, "code": department.code},
            "units": obj.course.units,
            "level": obj.course.level,
        }

    def get_semester_detail(self, obj):
        return {"id": obj.semester_id, "term": obj.semester.term, "session": obj.semester.session_id, "is_current": obj.semester.is_current}

    def get_lecturer_detail(self, obj):
        if not obj.lecturer:
            return None
        return {"id": obj.lecturer_id, "staff_id": obj.lecturer.staff_id, "name": obj.lecturer.user.get_full_name()}

    def validate_lecturer(self, lecturer):
        if lecturer and (lecturer.user.role != User.Role.LECTURER):
            raise serializers.ValidationError("Only lecturers can be assigned to an offering.")
        return lecturer
