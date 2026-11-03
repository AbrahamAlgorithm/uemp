import pytest

from apps.accounts.models import StaffProfile, StudentProfile, User
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


def staff_url(user):
    return f"/api/staff/{user.staff_profile.pk}/"


@pytest.mark.parametrize("role", ["DEPT_ADMIN", "STUDENT", "SUPER_ADMIN"])
def test_a_department_admin_cannot_change_a_lecturers_role(people, role, sign_in, api):
    lecturer = people[User.Role.LECTURER]
    sign_in("admin.csc@uemp.test")

    response = api.patch(staff_url(lecturer), {"role": role}, format="json")

    assert response.status_code == 400
    assert "role" in response.json()
    lecturer.refresh_from_db()
    assert lecturer.role == User.Role.LECTURER


def test_the_staff_endpoint_never_changes_a_role_even_for_a_super_admin(people, sign_in, api):
    lecturer = people[User.Role.LECTURER]
    sign_in("superadmin@uemp.test")

    assert api.patch(staff_url(lecturer), {"role": "DEPT_ADMIN"}, format="json").status_code == 400
    lecturer.refresh_from_db()
    assert lecturer.role == User.Role.LECTURER


def test_resending_the_current_role_is_harmless(people, sign_in, api):
    sign_in("admin.csc@uemp.test")

    response = api.patch(staff_url(people[User.Role.LECTURER]), {"role": "LECTURER", "phone": "07012345678"}, format="json")

    assert response.status_code == 200


def test_a_department_admin_does_not_see_other_admins_in_the_staff_endpoint(people, sign_in, api):
    admin = people[User.Role.DEPT_ADMIN]
    sign_in("admin.csc@uemp.test")

    listed = api.get("/api/staff/").json()["results"]

    assert {row["role"] for row in listed} == {"LECTURER"}
    assert api.get(staff_url(admin)).status_code == 404
    assert api.patch(staff_url(admin), {"first_name": "Changed"}, format="json").status_code == 404


def test_student_and_staff_records_cannot_be_deleted(people, students, sign_in, api):
    sign_in("admin.csc@uemp.test")
    assert api.delete(f"/api/students/{students['csc'].pk}/").status_code == 405
    assert api.delete(staff_url(people[User.Role.LECTURER])).status_code == 405

    sign_in("superadmin@uemp.test")
    assert api.delete(f"/api/students/{students['csc'].pk}/").status_code == 405
    assert api.delete(staff_url(people[User.Role.DEPT_ADMIN])).status_code == 405
    assert StudentProfile.objects.filter(pk=students["csc"].pk).exists()
    assert StaffProfile.objects.filter(user=people[User.Role.DEPT_ADMIN]).exists()


def test_an_email_already_in_use_is_a_validation_error_not_a_crash(people, students, sign_in, api):
    sign_in("admin.csc@uemp.test")

    student = api.patch(f"/api/students/{students['late'].pk}/", {"email": "student@uemp.test"}, format="json")
    staff = api.patch(staff_url(people[User.Role.LECTURER]), {"email": "admin.csc@uemp.test"}, format="json")

    assert (student.status_code, staff.status_code) == (400, 400)
    assert student.json()["email"] == "An account with this email already exists."


def test_a_super_admin_cannot_create_staff_with_a_student_role(csc, people, sign_in, api):
    sign_in("superadmin@uemp.test")
    body = {
        "first_name": "Ada", "last_name": "Obi", "email": "new.staff@uemp.test", "staff_id": "CVU/CSC/099",
        "role": "STUDENT", "department": csc.pk, "initial_password": "Demo@2026x",
    }

    assert api.post("/api/staff/", body, format="json").status_code == 400
    assert not User.objects.filter(email="new.staff@uemp.test").exists()


def test_a_profile_update_audit_row_keeps_the_name_and_email_changes(people, students, sign_in, api):
    sign_in("admin.csc@uemp.test")

    api.patch(f"/api/students/{students['csc'].pk}/", {"first_name": "Ngozi", "email": "ngozi@uemp.test"}, format="json")

    row = AuditLog.objects.filter(action="UPDATE", entity_type="accounts.studentprofile").latest("pk")
    assert (row.before["first_name"], row.after["first_name"]) == ("Ada", "Ngozi")
    assert (row.before["email"], row.after["email"]) == ("student@uemp.test", "ngozi@uemp.test")
