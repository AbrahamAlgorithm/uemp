from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.registrations.serializers import PersonRefSerializer, SemesterBriefSerializer, StudentBriefSerializer, person
from core.serializers import reason_field

from .grading import FAIL
from .models import ResultEntry, ResultSheet
from .services import SCALE_WARNING, is_editable, student_count


class GradeBandSerializer(serializers.Serializer):
    grade = serializers.CharField(max_length=2)
    min = serializers.IntegerField(min_value=0, max_value=100)
    max = serializers.IntegerField(min_value=0, max_value=100)
    point = serializers.DecimalField(max_digits=3, decimal_places=2, min_value=0, max_value=5)


class GradeScaleSerializer(serializers.Serializer):
    bands = GradeBandSerializer(many=True)
    is_default = serializers.BooleanField()


class UpdateScaleSerializer(serializers.Serializer):
    bands = GradeBandSerializer(many=True, allow_empty=False)
    confirm = serializers.BooleanField(default=False)

    def validate_confirm(self, confirm):
        if not confirm:
            raise serializers.ValidationError(SCALE_WARNING)
        return confirm

    def validate_bands(self, bands):
        bands = sorted(({**band, "grade": band["grade"].strip().upper()} for band in bands), key=lambda band: band["min"])
        problems = []
        grades = [band["grade"] for band in bands]
        if len(set(grades)) != len(grades):
            problems.append("Each grade can only be used once.")
        problems += [f"{b['grade']} starts at {b['min']} but ends at {b['max']}." for b in bands if b["min"] > b["max"]]
        if bands[0]["min"] != 0:
            problems.append("The lowest band must start at 0.")
        if bands[-1]["max"] != 100:
            problems.append("The highest band must end at 100.")
        for lower, upper in zip(bands, bands[1:]):
            if upper["min"] <= lower["max"]:
                problems.append(f"{lower['grade']} and {upper['grade']} overlap.")
            elif upper["min"] > lower["max"] + 1:
                first, last = lower["max"] + 1, upper["min"] - 1
                missing = str(first) if first == last else f"{first}-{last}"
                problems.append(f"No band covers {missing}, between {lower['grade']} and {upper['grade']}.")
        # carry-overs and pass rates both look for this grade
        if bands[0]["grade"] != FAIL:
            problems.append(f"The band that starts at 0 must be {FAIL}, the grade for a failed course.")
        if problems:
            raise serializers.ValidationError(problems)
        return bands[::-1]


def score_field(maximum, name):
    return serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=0,
        max_value=maximum,
        allow_null=True,
        required=False,
        error_messages={
            "min_value": f"{name} scores can't be negative.",
            "max_value": f"{name} scores can't be more than {maximum}.",
            "max_decimal_places": f"{name} scores can have at most 2 decimal places.",
        },
    )


class EntryScoreSerializer(serializers.Serializer):
    registration_id = serializers.IntegerField(min_value=1)
    ca_score = score_field(40, "CA")
    exam_score = score_field(60, "Exam")


class SaveScoresSerializer(serializers.Serializer):
    entries = EntryScoreSerializer(many=True, allow_empty=False)


class SubmitSheetSerializer(serializers.Serializer):
    confirm_incomplete = serializers.BooleanField(default=False)


class ImportScoresSerializer(serializers.Serializer):
    file = serializers.FileField()
    dry_run = serializers.BooleanField(default=True)


class ImportSummarySerializer(serializers.Serializer):
    rows = serializers.IntegerField()
    will_change = serializers.IntegerField()
    unchanged = serializers.IntegerField()
    errors = serializers.IntegerField()


class ImportRowSerializer(serializers.Serializer):
    row_number = serializers.IntegerField()
    matric_no = serializers.CharField(allow_blank=True)
    name = serializers.CharField(allow_null=True)
    status = serializers.ChoiceField(choices=["change", "unchanged", "error"])
    ca_before = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    ca_after = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    exam_before = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    exam_after = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    error = serializers.CharField(allow_null=True)


class ImportReportSerializer(serializers.Serializer):
    summary = ImportSummarySerializer()
    rows = ImportRowSerializer(many=True)


class RejectSheetSerializer(serializers.Serializer):
    feedback = reason_field("Feedback")


class ReopenSheetSerializer(serializers.Serializer):
    reason = reason_field("The reason")


class CourseRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    title = serializers.CharField()
    units = serializers.IntegerField()
    level = serializers.IntegerField()


class CodedRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()


def course_ref(course):
    return {"id": course.pk, "code": course.code, "title": course.title, "units": course.units, "level": course.level}


def department_ref(department):
    return {"id": department.pk, "code": department.code, "name": department.name}


class EntrySerializer(serializers.ModelSerializer):
    matric_no = serializers.CharField(source="registration.student.matric_no")
    name = serializers.CharField(source="registration.student.user.get_full_name")
    department = serializers.SerializerMethodField()
    is_carry_over = serializers.SerializerMethodField()

    class Meta:
        model = ResultEntry
        fields = [
            "registration_id", "matric_no", "name", "department", "is_carry_over",
            "ca_score", "exam_score", "total", "grade", "grade_point",
        ]

    @extend_schema_field(CodedRefSerializer)
    def get_department(self, entry):
        return department_ref(entry.registration.student.program.department)

    def get_is_carry_over(self, entry) -> bool:
        return entry.registration.student_id in self.context.get("carry_overs", ())


class IncompleteEntrySerializer(serializers.Serializer):
    registration_id = serializers.IntegerField()
    matric_no = serializers.CharField(source="registration.student.matric_no")
    name = serializers.CharField(source="registration.student.user.get_full_name")
    missing = serializers.SerializerMethodField()

    def get_missing(self, entry) -> list[str]:
        return [field for field in ("ca_score", "exam_score") if getattr(entry, field) is None]


class SummarySerializer(serializers.Serializer):
    students = serializers.IntegerField()
    scored = serializers.IntegerField()
    incomplete = serializers.IntegerField()
    average = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    highest = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    lowest = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    pass_rate = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    distribution = serializers.DictField(child=serializers.IntegerField())


class TimelineEventSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["SUBMITTED", "APPROVED", "REJECTED", "REOPENED"])
    at = serializers.DateTimeField()
    actor = PersonRefSerializer(allow_null=True)
    note = serializers.CharField(allow_blank=True)


class SheetSummarySerializer(serializers.ModelSerializer):
    offering_id = serializers.IntegerField()
    course = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    semester = SemesterBriefSerializer(source="offering.semester")
    lecturer = serializers.SerializerMethodField()
    submitted_by = serializers.SerializerMethodField()
    reviewed_by = serializers.SerializerMethodField()
    editable = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    scored_count = serializers.SerializerMethodField()

    class Meta:
        model = ResultSheet
        fields = [
            "id", "offering_id", "course", "department", "semester", "lecturer", "status", "editable", "feedback",
            "submitted_by", "submitted_at", "reviewed_by", "reviewed_at", "student_count", "scored_count",
        ]

    @extend_schema_field(CourseRefSerializer)
    def get_course(self, sheet):
        return course_ref(sheet.offering.course)

    @extend_schema_field(CodedRefSerializer)
    def get_department(self, sheet):
        return department_ref(sheet.offering.course.department)

    @extend_schema_field(PersonRefSerializer(allow_null=True))
    def get_lecturer(self, sheet):
        lecturer = sheet.offering.lecturer
        return person(lecturer.user) if lecturer else None

    @extend_schema_field(PersonRefSerializer(allow_null=True))
    def get_submitted_by(self, sheet):
        return person(sheet.submitted_by)

    @extend_schema_field(PersonRefSerializer(allow_null=True))
    def get_reviewed_by(self, sheet):
        return person(sheet.reviewed_by)

    def get_editable(self, sheet) -> bool:
        return is_editable(sheet)

    def get_student_count(self, sheet) -> int:
        return student_count(sheet, self.context["counts"])

    def get_scored_count(self, sheet) -> int:
        return self.context["counts"].get(sheet.offering_id, {}).get("scored", 0)


class SubmissionSerializer(SheetSummarySerializer):
    timeline = serializers.SerializerMethodField()

    class Meta(SheetSummarySerializer.Meta):
        fields = [*SheetSummarySerializer.Meta.fields, "timeline"]

    @extend_schema_field(TimelineEventSerializer(many=True))
    def get_timeline(self, sheet):
        return TimelineEventSerializer(self.context["timelines"].get(sheet.pk, []), many=True).data


class SheetDetailSerializer(SubmissionSerializer):
    entries = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta(SubmissionSerializer.Meta):
        fields = [*SubmissionSerializer.Meta.fields, "entries", "summary"]

    def get_student_count(self, sheet) -> int:
        return len(self.context["entries"])

    def get_scored_count(self, sheet) -> int:
        return self.context["summary"]["scored"]

    @extend_schema_field(EntrySerializer(many=True))
    def get_entries(self, sheet):
        return EntrySerializer(self.context["entries"], many=True, context=self.context).data

    @extend_schema_field(SummarySerializer)
    def get_summary(self, sheet):
        return SummarySerializer(self.context["summary"]).data


class LecturerOfferingSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    course = CourseRefSerializer()
    semester = SemesterBriefSerializer()
    sheet_id = serializers.IntegerField()
    sheet_status = serializers.ChoiceField(choices=ResultSheet.Status.choices)
    student_count = serializers.IntegerField()
    scored_count = serializers.IntegerField()


class CourseResultSerializer(serializers.Serializer):
    registration_id = serializers.IntegerField()
    code = serializers.CharField()
    title = serializers.CharField()
    units = serializers.IntegerField()
    ca_score = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    exam_score = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    total = serializers.DecimalField(max_digits=5, decimal_places=2)
    grade = serializers.CharField()
    grade_point = serializers.DecimalField(max_digits=3, decimal_places=2)
    is_carry_over = serializers.BooleanField()


class SemesterResultSerializer(serializers.Serializer):
    semester = SemesterBriefSerializer()
    courses = CourseResultSerializer(many=True)
    units = serializers.IntegerField()
    gpa = serializers.DecimalField(max_digits=3, decimal_places=2)


class StudentResultsSerializer(serializers.Serializer):
    student = StudentBriefSerializer()
    semesters = SemesterResultSerializer(many=True)
    cgpa = serializers.DecimalField(max_digits=3, decimal_places=2, allow_null=True)
    units_attempted = serializers.IntegerField()
    units_passed = serializers.IntegerField()
