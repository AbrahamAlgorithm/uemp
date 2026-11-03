from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.academics.models import AcademicSession, Department, Faculty, Program, Semester
from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.courses.models import Course, CourseOffering
from apps.results.models import GradeScale
from apps.audit.models import AuditLog


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
        fields = ["id", "session", "session_detail", "term", "is_current"]

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

    def get_department_detail(self, obj):
        if not obj.department:
            return None
        return {"id": obj.department_id, "name": obj.department.name, "code": obj.department.code}

    def get_identifier(self, obj):
        profile = getattr(obj, "student_profile", None) or getattr(obj, "staff_profile", None)
        return getattr(profile, "matric_no", None) or getattr(profile, "staff_id", None)

    def get_phone(self, obj):
        return getattr(getattr(obj, "student_profile", None), "phone", None) or getattr(
            getattr(obj, "staff_profile", None), "phone", ""
        )

    def get_student(self, obj):
        profile = getattr(obj, "student_profile", None)
        return StudentSerializer(profile).data if profile else None

    def get_staff(self, obj):
        profile = getattr(obj, "staff_profile", None)
        return StaffSerializer(profile).data if profile else None

    def get_recent_activity(self, obj):
        return [
            {"id": entry.id, "at": entry.created_at, "action": entry.action, "target": entry.target, "details": entry.details}
            for entry in AuditLog.objects.filter(actor=obj).order_by("-created_at")[:10]
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
    initial_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StudentProfile
        fields = [
            "id", "email", "first_name", "last_name", "matric_no", "level", "gender",
            "date_of_birth", "entry_session", "phone", "address", "status", "program",
            "program_detail", "department", "faculty", "initial_password",
        ]

    def get_department(self, obj):
        d = obj.program.department
        return {"id": d.id, "name": d.name, "code": d.code}

    def get_faculty(self, obj):
        f = obj.program.department.faculty
        return {"id": f.id, "name": f.name, "code": f.code}

    def get_program_detail(self, obj):
        return {"id": obj.program_id, "name": obj.program.name, "award": obj.program.award}

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
    initial_password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StaffProfile
        fields = [
            "id", "email", "first_name", "last_name", "staff_id", "title", "phone",
            "role", "status", "department", "faculty", "initial_password",
        ]

    def get_department(self, obj):
        d = obj.user.department
        return {"id": d.id, "name": d.name, "code": d.code} if d else None

    def get_faculty(self, obj):
        d = obj.user.department
        f = d.faculty if d else None
        return {"id": f.id, "name": f.name, "code": f.code} if f else None

    def validate_initial_password(self, value):
        validate_password(value)
        return value


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

    def validate_programs(self, programs):
        return programs


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


class GradeScaleSerializer(serializers.ModelSerializer):
    min = serializers.IntegerField(source="min_score")
    max = serializers.IntegerField(source="max_score")

    class Meta:
        model = GradeScale
        fields = ["id", "grade", "min", "max", "point"]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value
