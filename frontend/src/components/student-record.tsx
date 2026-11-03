"use client";

import { GraduationCap, TriangleAlert } from "lucide-react";

import type { Crumb } from "@/components/breadcrumbs";
import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { SemesterGradesTable } from "@/components/semester-grades-table";
import { StatCard } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { RegistrationStatusBadge, UserStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";
import type { Student } from "@/lib/types";

interface StudentRecordProps {
  studentId: number;
  crumbs: (student: Student) => Crumb[];
}

export function StudentRecord({ studentId, crumbs }: StudentRecordProps) {
  const { data, error, reload } = useAsync(() => api.getStudentRecord(studentId), studentId);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={0} rows={8} />;

  const { student } = data;

  return (
    <>
      <PageHeader
        breadcrumbs={[...crumbs(student), { label: student.fullName }]}
        title={student.fullName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {student.matricNumber} · {student.program.award} {student.program.name} · {student.level} level
            <UserStatusBadge status={student.status} />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <StatCard label="CGPA" tone="blue" value={formatGpa(data.cgpa)} icon={GraduationCap} hint="Approved results only" />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TriangleAlert className="size-4 text-orange-600" aria-hidden />
                Carry-overs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.carryOvers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No carry-over courses.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {data.carryOvers.map((course) => (
                    <li key={course.code} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <span>
                        <span className="font-medium">{course.code}</span> {course.title}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{course.units}u</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Email", value: student.email },
                { label: "Phone", value: student.phone },
                { label: "Faculty", value: student.faculty.name },
                { label: "Department", value: student.department.name },
                { label: "Entry session", value: student.entrySession },
                { label: "Address", value: student.address },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-4 text-lg font-semibold">Registrations and results</h2>
      {data.semesters.length === 0 ? (
        <Alert>
          <AlertTitle>No registrations yet</AlertTitle>
          <AlertDescription>This student hasn&apos;t submitted a course registration.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {[...data.semesters].reverse().map((semester) => (
            <Card key={semester.semester.id} className="pb-0">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-3">
                  {semesterLabel(semester.semester)}
                  <RegistrationStatusBadge status={semester.registration.status} />
                </CardTitle>
                <CardDescription>
                  {semester.courses.length} {semester.courses.length === 1 ? "course" : "courses"} · {semester.totalUnits} units
                  {semester.registration.status === "RETURNED" && ` · returned: ${semester.registration.returnReason}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {semester.courses.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">No courses on this registration.</p>
                ) : (
                  <SemesterGradesTable semester={semester} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
