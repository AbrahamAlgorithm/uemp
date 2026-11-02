"use client";

import { BookOpen, ClipboardList, GraduationCap, Layers, Mail, Phone } from "lucide-react";
import Link from "next/link";

import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate, initials, semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";

export default function StudentDashboardPage() {
  const { data, error, reload } = useAsync(api.getStudentDashboard);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={4} />;

  const { student, semester } = data;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${student.firstName}`}
        description={semesterLabel(semester)}
        actions={
          <Button asChild>
            <Link href="/student/registration">
              <ClipboardList />
              Register courses
            </Link>
          </Button>
        }
      />

      <Card className="mb-6 gap-0 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center gap-4 lg:w-80">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary text-lg font-medium text-primary-foreground">
                {initials(student.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <p className="text-xl leading-tight font-semibold tracking-tight">{student.fullName}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{student.matricNumber}</p>
              <UserStatusBadge status={student.status} />
            </div>
          </div>
          <DetailList
            className="flex-1 border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 xl:grid-cols-3"
            items={[
              { label: "Faculty", value: student.faculty.name },
              { label: "Department", value: student.department.name },
              { label: "Programme", value: `${student.program.award} ${student.program.name}` },
              { label: "Level", value: `${student.level} level` },
              { label: "Entry session", value: student.entrySession },
              { label: "Date of birth", value: formatDate(student.dateOfBirth) },
            ]}
          />
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center">
          <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <Mail className="size-4 shrink-0" aria-hidden />
            <span className="break-all text-foreground">{student.email}</span>
          </p>
          <p className="flex items-center gap-2 text-muted-foreground sm:ml-4">
            <Phone className="size-4 shrink-0" aria-hidden />
            <span className="text-foreground tabular-nums">{student.phone}</span>
          </p>
          <Button variant="outline" size="sm" className="sm:ml-auto" asChild>
            <Link href="/student/profile">View full profile</Link>
          </Button>
        </div>
      </Card>

      <StatGrid>
        <StatCard
          label="CGPA"
          value={formatGpa(data.cgpa)}
          icon={GraduationCap}
          tone="blue"
          hint="Approved results only"
          href="/student/results"
        />
        <StatCard
          label="Registered units"
          value={`${data.registeredUnits} / ${data.maxUnits}`}
          icon={ClipboardList}
          tone="violet"
          hint="This semester"
          href="/student/courses"
        />
        <StatCard
          label="Courses"
          value={data.registeredCourses}
          icon={BookOpen}
          tone="green"
          hint="Registered this semester"
          href="/student/courses"
        />
        <StatCard label="Level" value={student.level} icon={Layers} tone="orange" hint={`${student.program.award} ${student.program.name}`} />
      </StatGrid>
    </>
  );
}
