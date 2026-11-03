"use client";

import { BookOpen, FileDown, GraduationCap, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { RegistrationPanel } from "@/components/registration-panel";
import { SemesterGradesTable } from "@/components/semester-grades-table";
import { StatCard } from "@/components/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { RegistrationStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { SEMESTER_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatGpa } from "@/lib/grading";
import type { SemesterCourses } from "@/lib/types";

export default function MyCoursesPage() {
  const sessions = useAsync(api.getMySessions);
  const [chosen, setChosen] = useState<number>();
  // the server answers with the current session until one is picked
  const courses = useAsync(() => api.getMyCourses(chosen), chosen ?? "current");

  const error = sessions.error ?? courses.error;
  if (error) return <ErrorState error={error} onRetry={() => (sessions.error ? sessions.reload() : courses.reload())} />;
  if (!sessions.data || !courses.data) return <PageSkeleton cards={1} rows={6} />;

  const data = courses.data;

  return (
    <>
      <PageHeader
        title="My courses"
        description={data.label}
        actions={
          <>
            <Select value={String(chosen ?? data.session.id)} onValueChange={(value) => setChosen(Number(value))}>
              <SelectTrigger aria-label="Session" className="w-full rounded-full pl-4 data-[size=default]:h-10 sm:w-auto sm:min-w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessions.data.map((session) => (
                  <SelectItem key={session.id} value={String(session.id)}>
                    {session.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <Link href="/student/my-courses/statement">
                <Printer />
                Print result statement
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6 max-w-xs">
        <StatCard label="CGPA" tone="blue" value={formatGpa(data.cgpa)} icon={GraduationCap} hint="Approved results only, on a 5.00 scale" />
      </div>

      {data.semesters.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No semesters recorded"
            description="This session has no semesters on the academic calendar."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {data.semesters.map((semester) => (
            <SemesterCard key={semester.semester.id} semester={semester} onChanged={courses.reload} />
          ))}
        </div>
      )}
    </>
  );
}

function SemesterCard({ semester, onChanged }: { semester: SemesterCourses; onChanged: () => void }) {
  const { registration } = semester;
  const registered = registration.status !== "NOT_SUBMITTED";

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          {SEMESTER_LABELS[semester.semester.name]}
          <RegistrationStatusBadge status={registration.status} />
        </CardTitle>
        <CardDescription>
          {registered
            ? `${semester.courses.length} ${semester.courses.length === 1 ? "course" : "courses"} · ${semester.totalUnits} units`
            : "No registration for this semester"}
          {registration.submittedAt && ` · submitted ${formatDate(registration.submittedAt)}`}
        </CardDescription>
        {registered && (
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/student/my-courses/slip?semester=${semester.semester.id}`}>
                <FileDown />
                Download slip
              </Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-0">
        {semester.isCurrent ? (
          <div className="px-6 pb-6">
            <RegistrationPanel onChanged={onChanged} />
          </div>
        ) : (
          <>
            {registration.status === "RETURNED" && (
              <Alert variant="destructive" className="mx-6 mb-4 w-auto">
                <AlertTitle>Returned by your department</AlertTitle>
                <AlertDescription>{registration.returnReason}</AlertDescription>
              </Alert>
            )}
            {semester.courses.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">You didn&apos;t register any courses this semester.</p>
            ) : (
              <SemesterGradesTable semester={semester} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
