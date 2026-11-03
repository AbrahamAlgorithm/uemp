"use client";

import { BookCheck, CalendarCheck, GraduationCap, Printer } from "lucide-react";
import Link from "next/link";

import { GradeScaleLegend } from "@/components/grade-scale-legend";
import { PageHeader } from "@/components/page-header";
import { SemesterResultsTable } from "@/components/semester-results-table";
import { StatCard } from "@/components/stat-card";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { SEMESTER_LABELS } from "@/lib/constants";
import { semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";

export default function StudentResultsPage() {
  const { data: loaded, error, reload } = useAsync(() => Promise.all([api.getMyResults(), api.getGradeScale()]));

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!loaded) return <PageSkeleton cards={3} rows={8} />;

  const [data, scale] = loaded;

  if (data.semesters.length === 0) {
    return (
      <>
        <PageHeader title="Results" />
        <Card>
          <EmptyState
            icon={GraduationCap}
            title="No approved results yet"
            description="Results appear here once your department approves them."
          />
        </Card>
        <div className="mt-6">
          <GradeScaleLegend scale={scale} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Results"
        description="Only results approved by your department are shown."
        actions={
          <Button variant="outline" asChild>
            <Link href="/student/results/print">
              <Printer />
              Print statement
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="CGPA" tone="blue" value={formatGpa(data.cgpa)} icon={GraduationCap} hint="On a 5.00 scale" />
        <StatCard
          label="Units passed"
          tone="green"
          value={data.unitsPassed}
          icon={BookCheck}
          hint={`Of ${data.unitsAttempted} attempted, retakes counted each time`}
        />
        <StatCard label="Semesters" tone="violet" value={data.semesters.length} icon={CalendarCheck} hint="With approved results" />
      </div>

      <Card className="mt-6 pb-0">
        <CardHeader>
          <CardTitle>Academic history</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Session</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead className="text-right">Courses</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">GPA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.semesters.map((result) => (
              <TableRow key={result.semester.id}>
                <TableCell className="font-medium">{result.semester.session.name}</TableCell>
                <TableCell>{SEMESTER_LABELS[result.semester.name]}</TableCell>
                <TableCell className="text-right tabular-nums">{result.courses.length}</TableCell>
                <TableCell className="text-right tabular-nums">{result.units}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatGpa(result.gpa)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="mt-6 space-y-6">
        {[...data.semesters].reverse().map((result) => (
          <Card key={result.semester.id} className="pb-0">
            <CardHeader>
              <CardTitle>{semesterLabel(result.semester)}</CardTitle>
              <CardDescription>
                {result.courses.length} {result.courses.length === 1 ? "course" : "courses"} · {result.units} units · GPA{" "}
                {formatGpa(result.gpa)}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <SemesterResultsTable result={result} />
            </CardContent>
          </Card>
        ))}
        <GradeScaleLegend scale={scale} />
      </div>
    </>
  );
}
