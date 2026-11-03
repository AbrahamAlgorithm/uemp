from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import StaffProfile, StudentProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "department", "status", "is_staff")
    list_filter = ("role", "status", "department", "is_staff", "is_superuser", "is_active")
    search_fields = ("email", "first_name", "last_name")
    list_select_related = ("department",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        ("Portal", {"fields": ("role", "department", "status")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "role", "department", "usable_password", "password1", "password2"),
            },
        ),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ("matric_no", "user", "program", "level", "gender")
    search_fields = ("matric_no", "user__email", "user__first_name", "user__last_name")
    list_filter = ("level", "gender", "program__department", "program")
    list_select_related = ("user", "program")
    autocomplete_fields = ("user", "program")


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ("staff_id", "title", "user", "phone")
    search_fields = ("staff_id", "user__email", "user__first_name", "user__last_name")
    list_filter = ("user__role", "title", "user__department")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
