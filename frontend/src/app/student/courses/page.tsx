"use client";

import { BookOpen, CircleAlert, Info, Printer } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { RegistrationStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate, semesterLabel } from "@/lib/format";

export default function MyCoursesPage() {
  const { data: slip, error, reload } = useAsync(api.getRegistrationSlip);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (slip === undefined) return <PageSkeleton rows={6} />;

  if (slip === null) {
    return (
      <>
        <PageHeader title="My courses" description="This semester" />
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No registration yet"
            description="Choose this semester's courses and submit them for validation to see them here."
            action={
              <Button asChild>
                <Link href="/student/registration">Go to registration</Link>
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My courses"
        description={semesterLabel(slip.semester)}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <RegistrationStatusBadge status={slip.status} />
            <Button variant="outline" asChild>
              <Link href="/student/courses/print">
                <Printer />
                Print registration slip
              </Link>
            </Button>
          </div>
        }
      />
      {slip.status === "SUBMITTED" && (
        <Alert className="mb-6">
          <Info />
          <AlertTitle>Pending validation</AlertTitle>
          <AlertDescription>
            Submitted {formatDate(slip.submittedAt)}. These courses reach class lists once your department validates them.
          </AlertDescription>
        </Alert>
      )}
      {slip.status === "RETURNED" && (
        <Alert variant="destructive" className="mb-6">
          <CircleAlert />
          <AlertTitle>Returned by your department</AlertTitle>
          <AlertDescription>
            {slip.returnReason}{" "}
            <Link href="/student/registration" className="font-medium underline underline-offset-4">
              Update your registration
            </Link>
          </AlertDescription>
        </Alert>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Lecturer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slip.courses.map((course) => (
              <TableRow key={course.offeringId}>
                <TableCell className="font-medium whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {course.code}
                    {course.isCarryOver && (
                      <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                        Carry-over
                      </Badge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="min-w-56">{course.title}</TableCell>
                <TableCell className="text-right tabular-nums">{course.units}</TableCell>
                <TableCell className="tabular-nums">{course.level}</TableCell>
                <TableCell className="whitespace-nowrap">{course.lecturer ?? "To be assigned"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                Total
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{slip.totalUnits}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    </>
  );
}
