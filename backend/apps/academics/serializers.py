from rest_framework import serializers

from apps.accounts.models import StudentProfile, User

from .models import AcademicSession, Department, Faculty, Program, Semester


class FacultySerializer(serializers.ModelSerializer):
    department_count = serializers.IntegerField(source="departments.count", read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Faculty
        fields = ["id", "name", "code", "department_count", "student_count"]

    def get_student_count(self, obj):
        return StudentProfile.objects.filter(program__department__faculty=obj).count()


class DepartmentSerializer(serializers.ModelSerializer):
    faculty = serializers.PrimaryKeyRelatedField(queryset=Faculty.objects.all())
    faculty_detail = serializers.SerializerMethodField(source="faculty", read_only=True)
    program_count = serializers.IntegerField(source="programs.count", read_only=True)
    student_count = serializers.SerializerMethodField()
    lecturer_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["id", "name", "code", "faculty", "faculty_detail", "program_count", "student_count", "lecturer_count"]

    def get_faculty_detail(self, obj):
        return {"id": obj.faculty_id, "name": obj.faculty.name, "code": obj.faculty.code}

    def get_student_count(self, obj):
        return StudentProfile.objects.filter(program__department=obj).count()

    def get_lecturer_count(self, obj):
        return User.objects.filter(department=obj, role=User.Role.LECTURER).count()


class SessionSerializer(serializers.ModelSerializer):
    semesters = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = AcademicSession
        fields = ["id", "name", "start_date", "end_date", "is_current", "semesters"]

    def get_semesters(self, obj):
        return SemesterSerializer(obj.semesters.all(), many=True).data

    def get_is_current(self, obj):
        return obj.semesters.filter(is_current=True).exists()


class SemesterSerializer(serializers.ModelSerializer):
    session = serializers.PrimaryKeyRelatedField(queryset=AcademicSession.objects.all())
    session_detail = serializers.SerializerMethodField(source="session", read_only=True)

    class Meta:
        model = Semester
        fields = ["id", "session", "session_detail", "term", "is_current", "registration_open"]

    def get_session_detail(self, obj):
        return {"id": obj.session_id, "name": obj.session.name}


class ProgramSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    department_detail = serializers.SerializerMethodField(source="department", read_only=True)
    levels = serializers.SerializerMethodField()
    students_by_level = serializers.SerializerMethodField()
    course_count = serializers.IntegerField(source="courses.count", read_only=True)

    class Meta:
        model = Program
        fields = [
            "id", "name", "award", "duration_years", "department", "department_detail",
            "levels", "students_by_level", "course_count",
        ]

    def get_department_detail(self, obj):
        return {"id": obj.department_id, "name": obj.department.name, "code": obj.department.code}

    def get_levels(self, obj):
        return list(range(100, (obj.duration_years + 1) * 100, 100))

    def get_students_by_level(self, obj):
        return [
            {"level": level, "count": obj.students.filter(level=level).count()}
            for level in (100, 200, 300, 400, 500)
            if level <= obj.duration_years * 100
        ]
