from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db

URL = "/api/auth/me/profile/"
ADMIN_ONLY = ["This field can only be changed by an administrator."]


def audit_rows(user):
    return AuditLog.objects.filter(actor=user, action="PROFILE_UPDATED")


def years_ago(years, extra_days=0):
    today = date.today()
    return (today.replace(year=today.year - years) - timedelta(days=extra_days)).isoformat()


def test_student_updates_phone_address_and_date_of_birth(people, sign_in, api):
    student = people[User.Role.STUDENT]
    sign_in("student@uemp.test")
    body = {"phone": "0803 123 4567", "address": "  12 Allen Avenue, Ikeja, Lagos ", "date_of_birth": "2006-04-12"}

    response = api.patch(URL, body, format="json")

    assert response.status_code == 200
    profile = response.json()["profile"]
    assert (profile["phone"], profile["address"], profile["date_of_birth"]) == (
        "08031234567", "12 Allen Avenue, Ikeja, Lagos", "2006-04-12",
    )
    stored = StudentProfile.objects.get(user=student)
    assert (stored.phone, stored.date_of_birth) == ("08031234567", date(2006, 4, 12))


def test_a_partial_update_leaves_the_other_fields_alone(people, sign_in, api):
    StudentProfile.objects.filter(user=people[User.Role.STUDENT]).update(phone="08030000000", address="Old address")
    sign_in("student@uemp.test")

    api.patch(URL, {"address": "New address, Ibadan"}, format="json")

    stored = StudentProfile.objects.get(user=people[User.Role.STUDENT])
    assert (stored.phone, stored.address) == ("08030000000", "New address, Ibadan")


@pytest.mark.parametrize("value", [(date.today() + timedelta(days=1)).isoformat(), date.today().isoformat()])
def test_a_future_or_current_date_of_birth_is_refused(people, value, sign_in, api):
    sign_in("student@uemp.test")

    response = api.patch(URL, {"date_of_birth": value}, format="json")

    assert response.status_code == 400
    assert response.json()["date_of_birth"] == ["Date of birth must be in the past."]


def test_a_student_under_fourteen_is_refused_and_exactly_fourteen_is_allowed(people, sign_in, api):
    sign_in("student@uemp.test")

    too_young = api.patch(URL, {"date_of_birth": years_ago(14, extra_days=-1)}, format="json")
    assert too_young.status_code == 400
    assert too_young.json()["date_of_birth"] == ["You must be at least 14 years old."]

    assert api.patch(URL, {"date_of_birth": years_ago(14)}, format="json").status_code == 200


@pytest.mark.parametrize(
    "field, value",
    [
        ("first_name", "Ada"),
        ("last_name", "Obi"),
        ("email", "new@uemp.test"),
        ("matric_no", "CSC/2024/9999"),
        ("program", 1),
        ("level", 400),
        ("status", "ACTIVE"),
        ("role", "SUPER_ADMIN"),
    ],
)
def test_students_cannot_change_administrator_fields(people, field, value, sign_in, api):
    student = people[User.Role.STUDENT]
    sign_in("student@uemp.test")

    response = api.patch(URL, {field: value}, format="json")

    assert response.status_code == 400
    assert response.json() == {field: ADMIN_ONLY}
    assert not audit_rows(student).exists()
    student.refresh_from_db()
    assert (student.email, student.role) == ("student@uemp.test", User.Role.STUDENT)
    assert StudentProfile.objects.get(user=student).matric_no == "CSC/2024/0001"


def test_one_forbidden_field_refuses_the_whole_request(people, sign_in, api):
    sign_in("student@uemp.test")

    response = api.patch(URL, {"phone": "08031234567", "level": 400}, format="json")

    assert response.status_code == 400
    assert StudentProfile.objects.get(user=people[User.Role.STUDENT]).phone != "08031234567"


@pytest.mark.parametrize("phone", ["12345", "0123456789012", "+1555123456", "not a number"])
def test_phone_must_be_a_nigerian_number(people, phone, sign_in, api):
    sign_in("student@uemp.test")

    assert api.patch(URL, {"phone": phone}, format="json").status_code == 400


def test_an_empty_update_is_refused(people, sign_in, api):
    sign_in("student@uemp.test")

    assert api.patch(URL, {}, format="json").status_code == 400


@pytest.mark.parametrize("email", ["lecturer@uemp.test", "admin.csc@uemp.test", "superadmin@uemp.test"])
def test_staff_update_their_phone(people, email, sign_in, api):
    sign_in(email)

    response = api.patch(URL, {"phone": "07012345678"}, format="json")

    assert response.status_code == 200
    assert response.json()["profile"]["phone"] == "07012345678"
    assert StaffProfile.objects.get(user__email=email).phone == "07012345678"


@pytest.mark.parametrize("field", ["address", "date_of_birth", "title", "staff_id", "email", "first_name", "role"])
def test_staff_can_change_nothing_but_their_phone(people, field, sign_in, api):
    sign_in("lecturer@uemp.test")

    response = api.patch(URL, {field: "x"}, format="json")

    assert response.status_code == 400
    assert response.json() == {field: ADMIN_ONLY}


def test_each_change_writes_one_audit_row_with_before_and_after(people, sign_in, api):
    student = people[User.Role.STUDENT]
    StudentProfile.objects.filter(user=student).update(phone="08030000000", address="Old address")
    sign_in("student@uemp.test")

    api.patch(URL, {"phone": "08031234567", "address": "New address, Ibadan"}, format="json")

    row = audit_rows(student).get()
    assert row.before == {"phone": "08030000000", "address": "Old address"}
    assert row.after == {"phone": "08031234567", "address": "New address, Ibadan"}
    assert row.entity_type == "accounts.studentprofile"
    assert row.department == student.department

    api.patch(URL, {"date_of_birth": "2006-04-12"}, format="json")
    assert audit_rows(student).count() == 2
    assert audit_rows(student).order_by("-pk").first().after == {"date_of_birth": "2006-04-12"}


def test_staff_updates_are_audited_and_unchanged_values_are_not(people, sign_in, api):
    lecturer = people[User.Role.LECTURER]
    sign_in("lecturer@uemp.test")

    api.patch(URL, {"phone": "07012345678"}, format="json")
    api.patch(URL, {"phone": "07012345678"}, format="json")

    row = audit_rows(lecturer).get()
    assert row.after == {"phone": "07012345678"}
    assert row.department == lecturer.department


def test_the_endpoint_needs_a_session(people, api):
    assert api.patch(URL, {"phone": "08031234567"}, format="json").status_code == 401


def test_a_profile_update_without_the_csrf_token_is_rejected(people, sign_in):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("auth-csrf"))
    token = client.cookies["csrftoken"].value
    assert sign_in("student@uemp.test", client=client, HTTP_X_CSRFTOKEN=token).status_code == 200

    assert client.patch(URL, {"phone": "08031234567"}, format="json").status_code == 403
    assert client.patch(URL, {"phone": "08031234567"}, format="json", HTTP_X_CSRFTOKEN=token).status_code == 200
