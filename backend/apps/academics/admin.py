from django.contrib import admin

from .models import AcademicSession, Department, Faculty, Program, Semester


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "created_at")
    search_fields = ("code", "name")
    list_filter = ("created_at",)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "faculty")
    search_fields = ("code", "name", "faculty__name")
    list_filter = ("faculty",)
    list_select_related = ("faculty",)


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "duration_years")
    search_fields = ("name", "department__name", "department__code")
    list_filter = ("duration_years", "department__faculty", "department")
    list_select_related = ("department",)


@admin.register(AcademicSession)
class AcademicSessionAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)
    list_filter = ("created_at",)


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ("session", "term", "is_current")
    search_fields = ("session__name",)
    list_filter = ("is_current", "term", "session")
    list_select_related = ("session",)
