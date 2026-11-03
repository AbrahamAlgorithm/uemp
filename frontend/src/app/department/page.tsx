"use client";

import { BookOpen, ClipboardCheck, TriangleAlert, UserCog, Users } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity-feed";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDateTime, semesterLabel } from "@/lib/format";

export default function DepartmentDashboardPage() {
  const { data, error, reload } = useAsync(api.getDepartmentDashboard);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={6} />;

  const { counts } = data;

  return (
    <>
      <PageHeader
        title={`Department of ${data.department.name}`}
        description={`${data.department.faculty} · ${semesterLabel(data.semester)}`}
      />

      {data.unallocatedCourses > 0 && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800">
          <TriangleAlert />
          <AlertTitle>
            {data.unallocatedCourses} {data.unallocatedCourses === 1 ? "course has" : "courses have"} no lecturer this semester
          </AlertTitle>
          <AlertDescription>Students can register, but no one can enter their scores yet.</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" asChild>
              <Link href="/department/allocations">Assign lecturers</Link>
            </Button>
          </AlertAction>
        </Alert>
      )}

      <StatGrid>
        <StatCard label="Students" tone="blue" value={counts.students} icon={Users} href="/department/students" />
        <StatCard label="Lecturers" tone="violet" value={counts.lecturers} icon={UserCog} hint="Active" href="/department/lecturers" />
        <StatCard label="Courses" tone="green" value={counts.courses} icon={BookOpen} href="/department/courses" />
        <StatCard
          label="Pending approvals" tone="orange"
          value={counts.pendingApprovals}
          icon={ClipboardCheck}
          href="/department/results"
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Waiting for your review</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href="/department/results">All result sheets</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {data.pending.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="All caught up" description="No result sheets are waiting for approval." />
            ) : (
              <ul className="divide-y">
                {data.pending.map((sheet) => (
                  <li key={sheet.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {sheet.course.code} <span className="font-normal text-muted-foreground">{sheet.course.title}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sheet.lecturer?.name ?? "No lecturer"} · {sheet.studentCount} students · submitted {formatDateTime(sheet.submittedAt)}
                      </p>
                    </div>
                    <Button size="sm" asChild>
                      <Link href={`/department/results/${sheet.id}`}>Review</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={data.recentActivity} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
