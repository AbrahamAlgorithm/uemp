from django.contrib import admin

from .models import CourseRegistration, SemesterRegistration


@admin.register(SemesterRegistration)
class SemesterRegistrationAdmin(admin.ModelAdmin):
    list_display = ("student", "semester", "status", "submitted_at", "validated_by", "validated_at")
    search_fields = ("student__matric_no", "student__user__first_name", "student__user__last_name")
    list_filter = ("status", "semester", "student__program__department")
    list_select_related = ("student", "semester__session", "validated_by")
    autocomplete_fields = ("student", "validated_by")


@admin.register(CourseRegistration)
class CourseRegistrationAdmin(admin.ModelAdmin):
    list_display = ("student", "offering", "semester_registration", "created_at")
    search_fields = ("student__matric_no", "offering__course__code", "offering__course__title")
    list_filter = ("offering__semester", "offering__course__department", "semester_registration__status")
    list_select_related = ("student", "offering__course", "offering__semester__session", "semester_registration")
    autocomplete_fields = ("student", "offering", "semester_registration")
