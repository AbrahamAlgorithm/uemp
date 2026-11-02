"use client";

import { BookOpen, ClipboardList, GraduationCap, Layers } from "lucide-react";
import Link from "next/link";

import { DetailList } from "@/components/detail-list";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";

export default function StudentDashboardPage() {
  const { data, error, reload } = useAsync(api.getStudentDashboard);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={4} />;

  const { student, semester } = data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${student.firstName}`}
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
      <StatGrid>
        <StatCard label="CGPA" value={formatGpa(data.cgpa)} icon={GraduationCap} hint="Approved results only" href="/student/results" />
        <StatCard
          label="Registered units"
          value={`${data.registeredUnits} / ${data.maxUnits}`}
          icon={ClipboardList}
          hint="This semester"
          href="/student/courses"
        />
        <StatCard label="Courses" value={data.registeredCourses} icon={BookOpen} hint="Registered this semester" href="/student/courses" />
        <StatCard label="Level" value={student.level} icon={Layers} hint={`${student.program.award} ${student.program.name}`} />
      </StatGrid>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Student details</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href="/student/profile">View profile</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DetailList
            className="lg:grid-cols-3"
            items={[
              { label: "Name", value: student.fullName },
              { label: "Matric number", value: student.matricNumber },
              { label: "Faculty", value: student.faculty.name },
              { label: "Department", value: student.department.name },
              { label: "Program", value: `${student.program.award} ${student.program.name}` },
              { label: "Level", value: `${student.level} level` },
              { label: "Current semester", value: semesterLabel(semester) },
            ]}
          />
        </CardContent>
      </Card>
    </>
  );
}
