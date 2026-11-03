"use client";

import { CircleCheck, ClipboardList, GraduationCap, Info, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { RegistrationStatusBadge, UserStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { initials, semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";
import type { StudentOverview } from "@/lib/types";

const SLIP = "/student/my-courses/slip";

export default function StudentDashboardPage() {
  const { data, error, reload } = useAsync(api.getStudentOverview);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={3} rows={4} />;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${data.firstName}`}
        description={data.semester ? semesterLabel(data.semester) : "No semester is in progress"}
      />

      <Card className="mb-6 gap-0 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center gap-4 lg:w-80">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg font-medium text-primary-foreground">{initials(data.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <p className="text-xl leading-tight font-semibold tracking-tight">{data.name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{data.matricNumber}</p>
              <UserStatusBadge status={data.status} />
            </div>
          </div>
          <DetailList
            className="flex-1 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 xl:grid-cols-3"
            items={[
              { label: "Faculty", value: data.faculty.name },
              { label: "Department", value: data.department.name },
              { label: "Program", value: `${data.program.award} ${data.program.name}` },
              { label: "Level", value: `${data.level} level` },
              { label: "Entry session", value: data.entrySession },
              { label: "Email", value: <span className="break-all">{data.email}</span> },
            ]}
          />
        </div>
        <div className="mt-6 flex justify-end border-t pt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/student/profile">View full profile</Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4 text-primary" aria-hidden />
              CGPA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatGpa(data.cgpa)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.cgpa === null ? "No approved results yet." : "Approved results only, on a 5.00 scale."}
            </p>
          </CardContent>
        </Card>

        <RegistrationCard overview={data} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-orange-600" aria-hidden />
              Carry-overs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.carryOvers.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheck className="size-4 text-emerald-600" aria-hidden />
                No carry-over courses
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {data.carryOvers.map((course) => (
                  <li key={course.code} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span>
                      <span className="font-medium">{course.code}</span> {course.title}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{course.units}u</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RegistrationCard({ overview }: { overview: StudentOverview }) {
  const { status, returnReason, registrationOpen } = overview.registration;

  let message: React.ReactNode;
  let action: React.ReactNode = null;
  if (!overview.semester) {
    message = "No semester is in progress.";
  } else if (status === "NOT_SUBMITTED") {
    message = registrationOpen ? "Course registration is open. You haven't registered yet." : "Registration is closed.";
    if (registrationOpen) {
      action = (
        <Button asChild>
          <Link href="/student/my-courses">Start registration</Link>
        </Button>
      );
    }
  } else if (status === "SUBMITTED") {
    message = "Awaiting validation by your department.";
    action = <SlipLink />;
  } else if (status === "RETURNED") {
    message = `Returned: ${returnReason || "your department asked for changes"}.`;
    action = (
      <Button asChild>
        <Link href="/student/my-courses">Update your registration</Link>
      </Button>
    );
  } else {
    message = "Validated.";
    action = <SlipLink />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden />
            Registration
          </span>
          {overview.semester && <RegistrationStatusBadge status={status} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex gap-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{message}</span>
        </p>
        {action}
      </CardContent>
    </Card>
  );
}

function SlipLink() {
  return (
    <Button variant="outline" asChild>
      <Link href={SLIP}>Download slip</Link>
    </Button>
  );
}
