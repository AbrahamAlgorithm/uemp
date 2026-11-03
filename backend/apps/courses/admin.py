from django.contrib import admin

from .models import Course, CourseOffering


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "units", "level", "semester_term", "department")
    search_fields = ("code", "title")
    list_filter = ("level", "semester_term", "department")
    list_select_related = ("department",)
    filter_horizontal = ("programs",)


@admin.register(CourseOffering)
class CourseOfferingAdmin(admin.ModelAdmin):
    list_display = ("course", "semester", "lecturer")
    search_fields = ("course__code", "course__title", "lecturer__staff_id")
    list_filter = ("semester", "course__department")
    list_select_related = ("course", "semester__session", "lecturer__user")
    autocomplete_fields = ("course", "lecturer")
