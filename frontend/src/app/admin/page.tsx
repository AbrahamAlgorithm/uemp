"use client";

import { BookOpen, Building, ClipboardList, Users } from "lucide-react";
import Link from "next/link";

import { ActivityFeed } from "@/components/activity-feed";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate, semesterLabel } from "@/lib/format";


export default function AdminDashboardPage() {
  const { data, error, reload } = useAsync(api.getAdminDashboard);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={6} />;

  const { counts } = data;
  const pending = data.pendingByDepartment.reduce((sum, row) => sum + row.pending, 0);

  return (
    <>
      <PageHeader title="University overview" description={semesterLabel(data.semester)} />
      <StatGrid>
        <StatCard label="Students" tone="blue" value={counts.students} icon={Users} href="/admin/users" />
        <StatCard label="Lecturers" tone="violet" value={counts.lecturers} icon={Users} hint="Active" href="/admin/users" />
        <StatCard
          label="Departments" tone="green"
          value={counts.departments}
          icon={Building}
          hint={`In ${counts.faculties} faculties`}
          href="/admin/departments"
        />
        <StatCard
          label="Registrations" tone="orange"
          value={counts.registrations}
          icon={ClipboardList}
          hint={`${counts.courses} courses in the catalogue`}
          href="/admin/registrations"
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="h-fit pb-0">
          <CardHeader>
            <CardTitle>Pending approvals by department</CardTitle>
            <CardAction>
              <Badge variant={pending ? "default" : "secondary"}>{pending} pending</Badge>
            </CardAction>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Waiting since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pendingByDepartment.map((row) => (
                <TableRow key={row.department.id}>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium">{row.department.name}</p>
                    <p className="text-xs text-muted-foreground">{row.faculty}</p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{row.pending}</TableCell>
                  <TableCell>{formatDate(row.oldestSubmittedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-6 py-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/results">
                <BookOpen />
                Result approval oversight
              </Link>
            </Button>
          </div>
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
