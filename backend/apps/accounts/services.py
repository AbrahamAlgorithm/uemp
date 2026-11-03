from django.core.cache import cache
from django.db.models import Q

from .models import User


def find_user(identifier):
    """The account whose email, matric number or staff ID matches, ignoring case."""
    identifier = identifier.strip()
    return (
        User.objects.filter(
            Q(email__iexact=identifier)
            | Q(student_profile__matric_no__iexact=identifier)
            | Q(staff_profile__staff_id__iexact=identifier)
        )
        .order_by("pk")
        .first()
    )


def can_sign_in(user):
    return user.is_active and user.status == User.Status.ACTIVE


def identifier_of(user):
    student = getattr(user, "student_profile", None)
    if student is not None:
        return student.matric_no
    staff = getattr(user, "staff_profile", None)
    return staff.staff_id if staff is not None else user.email


def me_queryset():
    return User.objects.select_related(
        "department__faculty",
        "student_profile__program",
        "student_profile__entry_session",
        "staff_profile",
    )


class FailedLogins:
    """Failed sign-ins for one account in a fixed one-minute window."""

    limit = 5
    window = 60

    def __init__(self, user, identifier):
        # known aliases share an account lockout; unknown identifiers remain normalized and isolated
        subject = f"user:{user.pk}" if user is not None else f"id:{identifier.strip().lower()}"
        self.key = f"failed-logins:{subject}"

    def blocked(self):
        return cache.get(self.key, 0) >= self.limit

    def add(self):
        if not cache.add(self.key, 1, self.window):
            try:
                cache.incr(self.key)
            except ValueError:  # the window ran out between add() and incr()
                cache.add(self.key, 1, self.window)

    def clear(self):
        cache.delete(self.key)
