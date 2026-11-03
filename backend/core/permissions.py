from rest_framework.permissions import BasePermission

from apps.accounts.models import User

INACTIVE_ACCOUNT = "This account is not active. Contact the administrator."


class IsActiveUser(BasePermission):
    message = INACTIVE_ACCOUNT

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.status == User.Status.ACTIVE)


def HasRole(*roles):
    class RolePermission(IsActiveUser):
        message = "You don't have permission to do that."

        def has_permission(self, request, view):
            return super().has_permission(request, view) and request.user.role in roles

    RolePermission.__name__ = f"HasRole({', '.join(roles)})"
    return RolePermission


MANAGERS = (User.Role.DEPT_ADMIN, User.Role.SUPER_ADMIN)

IsStudent = HasRole(User.Role.STUDENT)
IsLecturer = HasRole(User.Role.LECTURER)
IsDeptAdmin = HasRole(User.Role.DEPT_ADMIN)
IsSuperAdmin = HasRole(User.Role.SUPER_ADMIN)
