"use client";

import { BookOpen, Clock, PencilLine, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatCard, StatGrid } from "@/components/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/components/session-provider";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { LecturerCourse } from "@/lib/types";

const needsAction = (course: LecturerCourse) => course.sheetStatus === "DRAFT" || course.sheetStatus === "REJECTED";

export default function LecturerDashboardPage() {
  const { user } = useSession();
  const { data, error, reload } = useAsync(() => api.getMyOfferings());

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={5} />;

  const rejected = data.filter((course) => course.sheetStatus === "REJECTED");

  return (
    <>
      <PageHeader title={`Welcome, ${user?.fullName ?? ""}`} description="Your courses and result sheets for this semester." />

      {rejected.length > 0 && (
        <Alert className="mb-6 border-red-200 bg-red-50 text-red-900 *:data-[slot=alert-description]:text-red-800">
          <TriangleAlert />
          <AlertTitle>
            {rejected.length === 1 ? "A result sheet was" : `${rejected.length} result sheets were`} returned for corrections
          </AlertTitle>
          <AlertDescription>
            <p>
              {rejected.map((course, index) => (
                <span key={course.offeringId}>
                  {index > 0 && ", "}
                  <Link href={`/lecturer/courses/${course.offeringId}/scores`} className="font-medium underline underline-offset-2">
                    {course.course.code}
                  </Link>
                </span>
              ))}
            </p>
          </AlertDescription>
        </Alert>
      )}

      <StatGrid>
        <StatCard label="Assigned courses" tone="blue" value={data.length} icon={BookOpen} href="/lecturer/courses" />
        <StatCard label="Students" tone="violet" value={data.reduce((sum, course) => sum + course.studentCount, 0)} icon={Users} hint="Across all courses" />
        <StatCard
          label="Needs your action" tone="orange"
          value={data.filter(needsAction).length}
          icon={PencilLine}
          hint="Drafts and returned sheets"
        />
        <StatCard
          label="Awaiting approval" tone="green"
          value={data.filter((course) => course.sheetStatus === "SUBMITTED").length}
          icon={Clock}
          href="/lecturer/submissions"
        />
      </StatGrid>

      <Card className="mt-6 pb-0">
        <CardHeader>
          <CardTitle>Result sheets</CardTitle>
        </CardHeader>
        {data.length === 0 ? (
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
              {data.map((course) => (
                <TableRow key={course.offeringId}>
                  <TableCell className="min-w-56">
                    <p className="font-medium">{course.course.code}</p>
                    <p className="text-xs text-muted-foreground">{course.course.title}</p>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {course.scoredCount} of {course.studentCount} scored
                  </TableCell>
                  <TableCell>
                    <SheetStatusBadge status={course.sheetStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={needsAction(course) ? "default" : "outline"} asChild>
                      <Link href={`/lecturer/courses/${course.offeringId}/scores`}>
                        {needsAction(course) ? "Enter scores" : "View scores"}
                      </Link>
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
