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
