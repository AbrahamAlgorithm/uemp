"use client";

import { BookOpen, Clock, PencilLine, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { useSession } from "@/components/session-provider";
import { StatCard, StatGrid } from "@/components/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import type { SheetStatus } from "@/lib/types";

const needsAction = (status: SheetStatus) => status === "DRAFT" || status === "REJECTED";

export default function LecturerDashboardPage() {
  const { user } = useSession();
  const { data, error, reload } = useAsync(api.getLecturerOverview);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={5} />;

  const { offerings } = data;
  const rejected = offerings.filter((offering) => offering.sheetStatus === "REJECTED");

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.fullName ?? ""}`}
        description={data.semester ? `Your courses and result sheets for ${semesterLabel(data.semester)}.` : "No semester is in progress."}
      />

      {rejected.length > 0 && (
        <Alert className="mb-6 border-red-200 bg-red-50 text-red-900 *:data-[slot=alert-description]:text-red-800">
          <TriangleAlert />
          <AlertTitle>
            {rejected.length === 1 ? "A result sheet was" : `${rejected.length} result sheets were`} returned for corrections
          </AlertTitle>
          <AlertDescription>
            <ul className="space-y-1">
              {rejected.map((offering) => (
                <li key={offering.id}>
                  <Link href={`/lecturer/courses/${offering.id}/scores`} className="font-medium underline underline-offset-2">
                    {offering.course.code}
                  </Link>
                  {offering.feedback && <span>: {offering.feedback}</span>}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <StatGrid>
        <StatCard label="Assigned courses" tone="blue" value={offerings.length} icon={BookOpen} href="/lecturer/courses" />
        <StatCard
          label="Students"
          tone="violet"
          value={offerings.reduce((sum, offering) => sum + offering.studentCount, 0)}
          icon={Users}
          hint="Across all courses"
        />
        <StatCard label="Needs your action" tone="orange" value={data.needsAction} icon={PencilLine} hint="Drafts and returned sheets" />
        <StatCard
          label="Awaiting approval"
          tone="green"
          value={offerings.filter((offering) => offering.sheetStatus === "SUBMITTED").length}
          icon={Clock}
          hint="With your department"
        />
      </StatGrid>

      <Card className="mt-6 pb-0">
        <CardHeader>
          <CardTitle>Result sheets</CardTitle>
        </CardHeader>
        {offerings.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses assigned" description="Your department hasn't assigned you any courses this semester." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerings.map((offering) => (
                <TableRow key={offering.id}>
                  <TableCell className="min-w-56">
                    <p className="font-medium">{offering.course.code}</p>
                    <p className="text-xs text-muted-foreground">{offering.course.title}</p>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {offering.scoredCount} of {offering.studentCount} scored
                  </TableCell>
                  <TableCell>
                    <SheetStatusBadge status={offering.sheetStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={needsAction(offering.sheetStatus) ? "default" : "outline"} asChild>
                      <Link href={`/lecturer/courses/${offering.id}`}>{needsAction(offering.sheetStatus) ? "Open course" : "View course"}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
