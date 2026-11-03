from django.core.exceptions import ImproperlyConfigured

from apps.accounts.models import User


def department_scope(user):
    """The department a user is limited to, or None when they can see every department."""
    if user.role == User.Role.SUPER_ADMIN:
        return None
    return user.department


class DepartmentScopedQuerysetMixin:
    department_lookup = None

    def get_queryset(self):
        if not self.department_lookup:
            raise ImproperlyConfigured(f"{type(self).__name__} needs a department_lookup")
        queryset = super().get_queryset()
        scope = department_scope(self.request.user)
        if scope is None:
            return queryset
        # filtering the queryset makes out-of-scope objects 404 instead of leaking that they exist
        return queryset.filter(**{self.department_lookup: scope})
