from django.urls import path

from .dashboards import (
    AdminDashboardView,
    DepartmentDashboardView,
    LecturerDashboardView,
    LecturerSemestersView,
    StudentDashboardView,
)
from .student import ResultStatementView, StudentCoursesView, StudentSessionsView
from .views import AtRiskReport, DepartmentsReport, PerformanceReport, RegistrationsReport, StudentsReport

urlpatterns = [
    path("student/dashboard/", StudentDashboardView.as_view(), name="student-dashboard"),
    path("student/sessions/", StudentSessionsView.as_view(), name="student-sessions"),
    path("student/courses/", StudentCoursesView.as_view(), name="student-courses"),
    path("student/results/statement/", ResultStatementView.as_view(), name="student-statement"),
    path("lecturer/dashboard/", LecturerDashboardView.as_view(), name="lecturer-dashboard"),
    path("lecturer/semesters/", LecturerSemestersView.as_view(), name="lecturer-semesters"),
    path("department/dashboard/", DepartmentDashboardView.as_view(), name="department-dashboard"),
    path("admin/dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("reports/students/", StudentsReport.as_view(), name="report-students"),
    path("reports/registrations/", RegistrationsReport.as_view(), name="report-registrations"),
    path("reports/performance/", PerformanceReport.as_view(), name="report-performance"),
    path("reports/at-risk/", AtRiskReport.as_view(), name="report-at-risk"),
    path("reports/departments/", DepartmentsReport.as_view(), name="report-departments"),
]
