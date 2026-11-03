from django.contrib import admin

from .models import CourseRegistration


@admin.register(CourseRegistration)
class CourseRegistrationAdmin(admin.ModelAdmin):
    list_display = ("student", "offering", "created_at")
    search_fields = ("student__matric_no", "offering__course__code", "offering__course__title")
    list_filter = ("offering__semester", "offering__course__department")
    list_select_related = ("student", "offering__course", "offering__semester__session")
    autocomplete_fields = ("student", "offering")
