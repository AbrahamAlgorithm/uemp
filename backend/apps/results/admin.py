from django.contrib import admin

from .models import GradeScale, ResultEntry, ResultSheet


@admin.register(GradeScale)
class GradeScaleAdmin(admin.ModelAdmin):
    list_display = ("grade", "min_score", "max_score", "point")
    search_fields = ("grade",)
    list_filter = ("grade",)
    ordering = ("-min_score",)


@admin.register(ResultSheet)
class ResultSheetAdmin(admin.ModelAdmin):
    list_display = ("offering", "status", "submitted_by", "submitted_at", "reviewed_by", "reviewed_at")
    search_fields = ("offering__course__code", "offering__course__title")
    list_filter = ("status", "offering__semester", "offering__course__department")
    list_select_related = ("offering__course", "offering__semester__session", "submitted_by", "reviewed_by")
    autocomplete_fields = ("offering", "submitted_by", "reviewed_by")


@admin.register(ResultEntry)
class ResultEntryAdmin(admin.ModelAdmin):
    list_display = ("registration", "ca_score", "exam_score", "total", "grade", "grade_point")
    search_fields = ("registration__student__matric_no", "registration__offering__course__code")
    list_filter = ("grade", "registration__offering__semester")
    list_select_related = (
        "registration__student",
        "registration__offering__course",
        "registration__offering__semester__session",
    )
    autocomplete_fields = ("registration",)
