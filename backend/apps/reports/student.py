from django.http import Http404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import AcademicSession, Semester
from apps.registrations.services import current_semester
from apps.registrations.views import int_param, student_of
from apps.results.grading import active_bands
from apps.results.records import Transcript, level_in, semester_records, start_year
from apps.results.serializers import GradeBandSerializer, SemesterRecordSerializer, StudentResultsSerializer
from apps.results.views import student_results
from core.permissions import IsStudent


def session_label(session, level):
    return f"{session.name} · {level} Level"


def reachable_sessions(student, current_session):
    """Sessions from the student's entry session to the current one, newest first."""
    if current_session is None:
        return []
    now = start_year(current_session)
    first = start_year(student.entry_session) if student.entry_session else None
    if first is None and now is not None:
        first = now - (student.level // 100 - 1)
    sessions = [
        session
        for session in AcademicSession.objects.all()
        if (year := start_year(session)) is not None and first <= year <= now
    ]
    return sorted(sessions, key=lambda session: session.name, reverse=True)


class StudentSessionsView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(summary="The sessions the student has been enrolled in, with their level in each", responses={200: None})
    def get(self, request):
        student = student_of(request)
        semester = current_semester()
        current = semester.session if semester else None
        rows = []
        for session in reachable_sessions(student, current):
            level = level_in(student, session, current)
            rows.append(
                {
                    "id": session.pk,
                    "name": session.name,
                    "level": level,
                    "label": session_label(session, level),
                    "is_current": session.pk == current.pk,
                }
            )
        return Response(rows)


class CourseSemesterSerializer(SemesterRecordSerializer):
    is_current = serializers.BooleanField()
    registration_open = serializers.BooleanField()


class StudentCoursesView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(
        summary="Both semesters of a session with registration status, courses and approved results",
        parameters=[OpenApiParameter("session", int, description="The current session unless given")],
        responses={200: None},
    )
    def get(self, request):
        student = student_of(request)
        semester = current_semester()
        if semester is None:
            raise Http404("No semester is in progress.")
        current = semester.session
        sessions = {session.pk: session for session in reachable_sessions(student, current)}
        session_id = int_param(request, "session") or current.pk
        session = sessions.get(session_id)
        if session is None:
            raise Http404("You weren't enrolled in that session.")

        transcript = Transcript(student)
        semesters = list(Semester.objects.filter(session=session).select_related("session").order_by("term"))
        records = semester_records(student, semesters, transcript)
        level = level_in(student, session, current)
        return Response(
            {
                "session": {"id": session.pk, "name": session.name, "is_current": session.pk == current.pk},
                "level": level,
                "label": session_label(session, level),
                "cgpa": transcript.cgpa,
                "semesters": CourseSemesterSerializer(
                    [
                        {
                            **record,
                            "is_current": record["semester"].pk == semester.pk,
                            "registration_open": record["semester"].registration_open,
                        }
                        for record in records
                    ],
                    many=True,
                ).data,
            }
        )


class StatementSerializer(StudentResultsSerializer):
    bands = GradeBandSerializer(many=True)
    generated_at = serializers.DateTimeField()


class ResultStatementView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(summary="Every approved result with GPA, CGPA and the grading legend, for printing", responses=StatementSerializer)
    def get(self, request):
        student = student_of(request)
        statement = {**student_results(student), "bands": active_bands(), "generated_at": timezone.now()}
        return Response(StatementSerializer(statement).data)
