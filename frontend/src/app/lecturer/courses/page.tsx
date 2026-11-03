"use client";

import { BookOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function LecturerCoursesPage() {
  const semesters = useAsync(api.getLecturerSemesters);
  const [chosen, setChosen] = useState<number>();
  // the api answers with the current semester until one is picked
  const offerings = useAsync(() => api.getMyOfferings(chosen), chosen ?? "current");

  const error = semesters.error ?? offerings.error;
  if (error) return <ErrorState error={error} onRetry={() => (semesters.error ? semesters.reload() : offerings.reload())} />;
  if (!semesters.data || !offerings.data) return <PageSkeleton rows={4} />;

  const shown = chosen ?? offerings.data[0]?.semester.id ?? semesters.data.find((semester) => semester.isCurrent)?.id;

  return (
    <>
      <PageHeader
        title="My courses"
        description="Courses allocated to you, with the state of each result sheet."
        actions={
          semesters.data.length > 0 && (
            <Select value={shown === undefined ? undefined : String(shown)} onValueChange={(value) => setChosen(Number(value))}>
              <SelectTrigger aria-label="Semester" className="w-full rounded-full pl-4 data-[size=default]:h-10 sm:w-auto sm:min-w-64">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.data.map((semester) => (
                  <SelectItem key={semester.id} value={String(semester.id)}>
                    {semesterLabel(semester)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      <Card className="py-0">
        {offerings.data.length === 0 ? (
          <EmptyState icon={BookOpen} title="No courses assigned" description="Your department hasn't assigned you any courses for this semester." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead>Sheet</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offerings.data.map((course) => {
                const editable = course.sheetStatus === "DRAFT" || course.sheetStatus === "REJECTED";
                return (
                  <TableRow key={course.offeringId}>
                    <TableCell className="font-medium whitespace-nowrap">{course.course.code}</TableCell>
                    <TableCell className="min-w-52">{course.course.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{course.course.units}</TableCell>
                    <TableCell className="text-right tabular-nums">{course.studentCount}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      <SheetStatusBadge status={course.sheetStatus} />
                      {course.feedback && (
                        <p className="mt-1 flex gap-1.5 text-xs text-red-700">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                          {course.feedback}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={editable ? "default" : "outline"} asChild>
                        <Link href={`/lecturer/courses/${course.offeringId}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
