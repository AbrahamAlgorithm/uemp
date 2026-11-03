import pytest
from django.urls import reverse

from apps.academics.models import AcademicSession, Faculty, Program, Semester
from apps.audit.models import AuditLog
from apps.courses.models import Course, CourseOffering
from apps.results.models import ResultSheet
from apps.accounts.models import User

pytestmark = pytest.mark.django_db


def test_super_admin_can_create_structure_and_set_current(people, sign_in, api):
    sign_in("superadmin@uemp.test")
    faculty = api.post("/api/faculties/", {"name": "Arts", "code": "ART"}, format="json")
    assert faculty.status_code == 201
    department = api.post("/api/departments/", {"name": "History", "code": "HIS", "faculty": faculty.json()["id"]}, format="json")
    assert department.status_code == 201
    session = api.post("/api/sessions/", {"name": "2026/2027"}, format="json")
    assert session.status_code == 201
    semester = api.post("/api/semesters/", {"session": session.json()["id"], "term": "FIRST"}, format="json")
    assert semester.status_code == 201
    assert api.post(f"/api/semesters/{semester.json()['id']}/set-current/").status_code == 200
    assert Semester.objects.filter(is_current=True).count() == 1
    assert AuditLog.objects.filter(action="SEMESTER_SET_CURRENT").count() == 1


def test_department_admin_is_scoped_and_cannot_use_super_admin_endpoints(people, csc, eee, sign_in, api):
    Program.objects.create(department=eee, name="Electrical", award="B.Eng.", duration_years=4)
    sign_in("admin.csc@uemp.test")
    assert api.get("/api/faculties/").status_code == 403
    assert api.get("/api/programs/").status_code == 200
    assert api.get("/api/programs/?department=%s" % eee.pk).json()["count"] == 0
    assert api.post("/api/staff/", {"email": "admin2@test.com", "first_name": "A", "last_name": "B", "staff_id": "EEE/001", "role": "DEPT_ADMIN", "initial_password": "StrongPass123!"}, format="json").status_code == 403


def test_students_and_lecturers_only_read_lookups(people, sign_in, api):
    sign_in("student@uemp.test")
    assert api.get("/api/semesters/current/").status_code in (200, 404)
    assert api.get("/api/grade-scale/").status_code == 200
    assert api.get("/api/programs/").status_code == 403
    sign_in("lecturer@uemp.test")
    assert api.get("/api/grade-scale/").status_code == 200
    assert api.get("/api/courses/").status_code == 403


def test_referenced_department_returns_conflict_and_users_cannot_delete(people, csc, api, sign_in):
    sign_in("superadmin@uemp.test")
    response = api.delete(f"/api/departments/{csc.pk}/")
    assert response.status_code == 409
    assert api.delete(f"/api/users/{people[User.Role.STUDENT].pk}/").status_code == 405


def test_offering_rejects_wrong_department_lecturer_and_locks_submitted_assignment(people, csc, eee, sign_in, api):
    course = Course.objects.create(department=csc, code="CSC 401", title="Systems", units=3, level=400, semester_term="FIRST")
    session = AcademicSession.objects.create(name="2027/2028")
    semester = Semester.objects.create(session=session, term="FIRST")
    sign_in("superadmin@uemp.test")
    offering = api.post("/api/offerings/", {"course": course.pk, "semester": semester.pk}, format="json")
    assert offering.status_code == 201
    eee_lecturer = User.objects.create_user(email="eee@test.com", password="StrongPass123!", role=User.Role.LECTURER, department=eee)
    from apps.accounts.models import StaffProfile
    profile = StaffProfile.objects.create(user=eee_lecturer, staff_id="EEE/002")
    assert api.patch(f"/api/offerings/{offering.json()['id']}/", {"lecturer": profile.pk}, format="json").status_code == 400
    ResultSheet.objects.filter(offering_id=offering.json()["id"]).update(status=ResultSheet.Status.SUBMITTED)
    csc_lecturer = people[User.Role.LECTURER].staff_profile
    assert api.patch(f"/api/offerings/{offering.json()['id']}/", {"lecturer": csc_lecturer.pk}, format="json").status_code == 409


def test_change_password_writes_audit(people, sign_in, api):
    sign_in("student@uemp.test")
    response = api.post("/api/auth/change-password/", {"current_password": "Demo@2026", "new_password": "NewStrongPass123!"}, format="json")
    assert response.status_code == 200
    assert AuditLog.objects.filter(action="PASSWORD_CHANGED").exists()


def test_super_admin_can_reset_password_and_retrieve_user_detail(people, sign_in, api):
    sign_in("superadmin@uemp.test")
    detail = api.get(f"/api/users/{people[User.Role.STUDENT].pk}/")
    assert detail.status_code == 200
    assert detail.json()["student"]["matric_no"] == "CSC/2024/0001"
    response = api.post(
        f"/api/users/{people[User.Role.STUDENT].pk}/reset-password/",
        {"new_password": "NewStrongPass123!"},
        format="json",
    )
    assert response.status_code == 200
    assert AuditLog.objects.filter(action="PASSWORD_RESET").exists()


def test_department_admin_can_create_student_and_lecturer_but_not_admin(people, csc, sign_in, api):
    program = Program.objects.create(department=csc, name="Software Engineering", award="B.Sc.", duration_years=4)
    session = AcademicSession.objects.create(name="2028/2029")
    sign_in("admin.csc@uemp.test")
    student = api.post(
        "/api/students/",
        {
            "email": "new.student@test.com",
            "first_name": "New",
            "last_name": "Student",
            "matric_no": "CSC/2028/0002",
            "program": program.pk,
            "level": 100,
            "entry_session": session.pk,
            "initial_password": "StrongPass123!",
        },
        format="json",
    )
    assert student.status_code == 201
    lecturer = api.post(
        "/api/staff/",
        {
            "email": "new.lecturer@test.com",
            "first_name": "New",
            "last_name": "Lecturer",
            "staff_id": "CVU/CSC/099",
            "title": "Dr.",
            "phone": "",
            "initial_password": "StrongPass123!",
        },
        format="json",
    )
    assert lecturer.status_code == 201
    assert lecturer.json()["role"] == User.Role.LECTURER
    assert api.post(
        "/api/staff/",
        {
            "email": "new.admin@test.com",
            "first_name": "New",
            "last_name": "Admin",
            "staff_id": "CVU/CSC/100",
            "role": User.Role.DEPT_ADMIN,
            "initial_password": "StrongPass123!",
        },
        format="json",
    ).status_code == 403
