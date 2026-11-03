"use client";

import { BookOpen, Building, ClipboardCheck, ClipboardList, UserCog, Users } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity-feed";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function AdminDashboardPage() {
  const { data, error, reload } = useAsync(api.getAdminOverview);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={6} />;

  const { totals } = data;

  return (
    <>
      <PageHeader title="University overview" description={data.semester ? semesterLabel(data.semester) : "No semester is in progress"} />
      <StatGrid>
        <StatCard label="Students" tone="blue" value={totals.students} icon={Users} href="/admin/users" />
        <StatCard label="Lecturers" tone="violet" value={totals.lecturers} icon={UserCog} hint="Active" href="/admin/users" />
        <StatCard
          label="Departments"
          tone="green"
          value={totals.departments}
          icon={Building}
          hint={`In ${totals.faculties} faculties`}
          href="/admin/structure"
        />
        <StatCard label="Courses" tone="neutral" value={totals.courses} icon={BookOpen} hint="In the catalogue" href="/admin/structure" />
      </StatGrid>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Registrations awaiting validation"
          tone="orange"
          value={totals.awaitingValidation}
          icon={ClipboardList}
          href="/admin/registrations"
        />
        <StatCard
          label="Result sheets awaiting review"
          tone="orange"
          value={totals.awaitingReview}
          icon={ClipboardCheck}
          href="/admin/results"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="h-fit pb-0">
          <CardHeader>
            <CardTitle>Departments</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">To validate</TableHead>
                <TableHead className="text-right">To review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.departments.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.faculty}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.students}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{row.awaitingValidation}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{row.awaitingReview}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/audit-log">See all</Link>
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
