"use client";

import { BookOpen, Printer } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate, semesterLabel } from "@/lib/format";


export default function MyCoursesPage() {
  const { data, error, reload } = useAsync(api.getMyCourses);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  return (
    <>
      <PageHeader
        title="My courses"
        description={semesterLabel(data.semester)}
        actions={
          data.courses.length > 0 && (
            <Button variant="outline" asChild>
              <Link href="/student/courses/print">
                <Printer />
                Print registration slip
              </Link>
            </Button>
          )
        }
      />
      <Card className="py-0">
        {data.courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses registered"
            description="Register for this semester's courses to see them here."
            action={
              <Button asChild>
                <Link href="/student/registration">Go to registration</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Lecturer</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium whitespace-nowrap">{course.code}</TableCell>
                  <TableCell className="min-w-56">{course.title}</TableCell>
                  <TableCell className="text-right tabular-nums">{course.units}</TableCell>
                  <TableCell className="whitespace-nowrap">{course.lecturer ?? "To be assigned"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(course.registeredAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{data.totalUnits}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>
    </>
  );
}
