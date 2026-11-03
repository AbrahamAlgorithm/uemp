"use client";

import { BookOpen, ClipboardCheck, ClipboardList, Layers, TriangleAlert, UserCog, Users } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity-feed";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function DepartmentDashboardPage() {
  const { data, error, reload } = useAsync(api.getDepartmentOverview);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={6} />;

  const { counts } = data;

  return (
    <>
      <PageHeader
        title={`Department of ${data.department.name}`}
        description={[data.department.faculty, data.semester && semesterLabel(data.semester)].filter(Boolean).join(" · ")}
      />

      {counts.unallocatedOfferings > 0 && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800">
          <TriangleAlert />
          <AlertTitle>
            {counts.unallocatedOfferings} {counts.unallocatedOfferings === 1 ? "course has" : "courses have"} no lecturer this semester
          </AlertTitle>
          <AlertDescription>Students can register, but no one can enter their scores yet.</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" asChild>
              <Link href="/department/allocations">Allocate courses</Link>
            </Button>
          </AlertAction>
        </Alert>
      )}

      <StatGrid>
        <StatCard label="Students" tone="blue" value={counts.students} icon={Users} href="/department/students" />
        <StatCard label="Lecturers" tone="violet" value={counts.lecturers} icon={UserCog} hint="Active" href="/department/lecturers" />
        <StatCard label="Courses" tone="green" value={counts.courses} icon={BookOpen} href="/department/courses" />
        <StatCard
          label="Offerings"
          tone="neutral"
          value={counts.currentOfferings}
          icon={Layers}
          hint="Courses running this semester"
          href="/department/allocations"
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Awaiting your review</h2>
          <StatCard
            label="Registrations to validate"
            tone="orange"
            value={data.awaitingValidation}
            icon={ClipboardList}
            hint={data.awaitingValidation ? "Students are waiting for their courses to be validated" : "All caught up"}
            href="/department/registrations"
          />
          <StatCard
            label="Result sheets to review"
            tone="orange"
            value={data.awaitingReview}
            icon={ClipboardCheck}
            hint={data.awaitingReview ? "Lecturers have submitted these for approval" : "All caught up"}
            href="/department/results"
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href="/department/activity">See all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ActivityFeed entries={data.recentActivity} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
