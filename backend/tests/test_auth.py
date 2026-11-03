import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.models import User
from apps.audit.models import AuditLog

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db

INVALID = {"detail": "Invalid credentials."}
INACTIVE = {"detail": "This account is not active. Contact the administrator."}


@pytest.mark.parametrize(
    ("identifier", "role"),
    [
        ("student@uemp.test", "STUDENT"),
        ("Student@UEMP.test", "STUDENT"),
        ("CSC/2024/0001", "STUDENT"),
        ("csc/2024/0001", "STUDENT"),
        ("CVU/CSC/073", "LECTURER"),
        ("cvu/csc/073", "LECTURER"),
        ("  cvu/reg/010 ", "SUPER_ADMIN"),
    ],
)
def test_login_accepts_email_matric_number_or_staff_id_in_any_case(people, sign_in, identifier, role):
    response = sign_in(identifier)

    assert response.status_code == 200
    assert response.json()["role"] == role


def test_login_sets_cookies_and_never_returns_tokens(people, sign_in, api):
    response = sign_in("student@uemp.test")

    body = response.json()
    assert not {"access", "refresh", "token"} & body.keys()
    assert body == api.get(reverse("auth-me")).json()

    access, refresh, role = (response.cookies[name] for name in ("uemp_access", "uemp_refresh", "uemp_role"))
    assert access["httponly"] and access["samesite"] == "Lax" and access["max-age"] == 15 * 60
    assert refresh["httponly"] and refresh["path"] == "/api/auth/" and refresh["max-age"] == 24 * 60 * 60
    assert role.value == "STUDENT" and not role["httponly"]
    assert AuditLog.objects.filter(action="LOGIN", actor=people["STUDENT"], target="CSC/2024/0001").exists()


@pytest.mark.parametrize(
    ("identifier", "password"),
    [("nobody@uemp.test", PASSWORD), ("CSC/9999/0001", PASSWORD), ("student@uemp.test", "wrong-password"), ("", "")],
)
def test_wrong_identifier_or_password_gets_the_same_401(people, sign_in, identifier, password):
    response = sign_in(identifier, password)

    assert response.status_code == 401
    assert response.json() == INVALID
    assert "uemp_access" not in response.cookies


@pytest.mark.parametrize("status", [User.Status.SUSPENDED, User.Status.INACTIVE])
def test_inactive_accounts_are_refused_only_after_a_correct_password(people, sign_in, status):
    User.objects.filter(pk=people["STUDENT"].pk).update(status=status)

    assert sign_in("student@uemp.test", "wrong-password").json() == INVALID
    response = sign_in("student@uemp.test")
    assert response.status_code == 403
    assert response.json() == INACTIVE
    assert "uemp_access" not in response.cookies


def test_suspension_rejects_tokens_that_were_already_issued(people, sign_in, api):
    sign_in("student@uemp.test")
    assert api.get(reverse("auth-me")).status_code == 200

    User.objects.filter(pk=people["STUDENT"].pk).update(status=User.Status.SUSPENDED)

    response = api.get(reverse("auth-me"))
    assert response.status_code == 401
    assert response.json() == INACTIVE
    assert api.post(reverse("auth-refresh")).status_code == 401


def test_refresh_rotates_the_cookies_and_blacklists_the_old_token(people, sign_in, api):
    sign_in("student@uemp.test")
    old = api.cookies["uemp_refresh"].value

    response = api.post(reverse("auth-refresh"))

    assert response.status_code == 204
    assert response.cookies["uemp_refresh"].value != old
    assert BlacklistedToken.objects.filter(token__token=old).exists()
    assert api.get(reverse("auth-me")).status_code == 200


def test_logout_blacklists_the_refresh_token_and_clears_cookies(people, sign_in, api):
    sign_in("student@uemp.test")
    refresh = api.cookies["uemp_refresh"].value

    response = api.post(reverse("auth-logout"))

    assert response.status_code == 204
    assert all(response.cookies[name].value == "" for name in ("uemp_access", "uemp_refresh", "uemp_role"))
    assert BlacklistedToken.objects.filter(token__token=refresh).exists()
    assert AuditLog.objects.filter(action="LOGOUT", actor=people["STUDENT"]).exists()

    api.cookies["uemp_refresh"] = refresh
    assert api.post(reverse("auth-refresh")).status_code == 401


@pytest.mark.parametrize(
    ("identifier", "role", "department", "profile_field"),
    [
        ("CSC/2024/0001", "STUDENT", "CSC", "matric_no"),
        ("CVU/CSC/073", "LECTURER", "CSC", "staff_id"),
        ("CVU/CSC/017", "DEPT_ADMIN", "CSC", "staff_id"),
        ("CVU/REG/010", "SUPER_ADMIN", None, "staff_id"),
    ],
)
def test_me_returns_role_department_and_profile(people, sign_in, api, identifier, role, department, profile_field):
    sign_in(identifier)

    body = api.get(reverse("auth-me")).json()

    assert body["role"] == role
    assert body["status"] == "ACTIVE"
    assert body["profile"][profile_field] == identifier
    if department is None:
        assert body["department"] is None
    else:
        assert body["department"]["code"] == department
        assert body["department"]["faculty"]["code"] == "SCI"


def test_student_profile_includes_program_gender_and_entry_session(people, sign_in, api):
    sign_in("student@uemp.test")

    profile = api.get(reverse("auth-me")).json()["profile"]

    assert profile["program"]["award"] == "B.Sc."
    assert profile["gender"] == "F"
    assert profile["entry_session"]["name"] == "2024/2025"


def test_me_needs_a_signed_in_user(api):
    assert api.get(reverse("auth-me")).status_code == 401


def test_unsafe_requests_without_the_csrf_token_are_rejected(people, sign_in):
    client = APIClient(enforce_csrf_checks=True)

    assert sign_in("student@uemp.test", client=client).status_code == 403

    client.get(reverse("auth-csrf"))
    token = client.cookies["csrftoken"].value
    assert sign_in("student@uemp.test", client=client, HTTP_X_CSRFTOKEN=token).status_code == 200
    assert client.post(reverse("auth-logout")).status_code == 403


TOO_MANY = {"detail": "Too many failed attempts. Try again in a minute."}


def test_five_failures_lock_the_account_even_for_the_right_password(people, sign_in):
    for _ in range(5):
        assert sign_in("student@uemp.test", "wrong-password").status_code == 401

    response = sign_in("student@uemp.test")
    assert response.status_code == 429
    assert response.json() == TOO_MANY
    assert sign_in("lecturer@uemp.test").status_code == 200


def test_every_way_of_naming_an_account_shares_one_count(people, sign_in):
    for identifier in ["student@uemp.test", "STUDENT@uemp.test", "CSC/2024/0001", "csc/2024/0001", "Csc/2024/0001"]:
        assert sign_in(identifier, "wrong-password").status_code == 401

    assert sign_in("student@uemp.test").status_code == 429


def test_a_successful_sign_in_resets_the_count(people, sign_in):
    for _ in range(4):
        sign_in("student@uemp.test", "wrong-password")
    assert sign_in("student@uemp.test").status_code == 200

    for _ in range(4):
        assert sign_in("student@uemp.test", "wrong-password").status_code == 401
    assert sign_in("student@uemp.test").status_code == 200


def test_unknown_identifiers_lock_the_same_way(people, sign_in):
    for _ in range(5):
        assert sign_in("nobody@uemp.test", "wrong-password").json() == INVALID

    assert sign_in("nobody@uemp.test", "wrong-password").json() == TOO_MANY


def test_one_ip_gets_thirty_attempts_a_minute(people, sign_in):
    for n in range(30):
        assert sign_in(f"nobody{n}@uemp.test", "wrong-password").status_code == 401

    assert sign_in("student@uemp.test").status_code == 429
