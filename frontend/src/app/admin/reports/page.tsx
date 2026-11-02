"use client";

import { Printer } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatPercent, semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";
import type { SheetStatus } from "@/lib/types";

const STATUSES: SheetStatus[] = ["DRAFT", "SUBMITTED", "REJECTED", "APPROVED"];

export default function UniversityReportsPage() {
  const { data, error, reload } = useAsync(api.getUniversityReport);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const sum = (key: "students" | "lecturers" | "courses" | "registrations") =>
    data.departments.reduce((total, row) => total + row[key], 0);
  const levels = data.studentsByLevel.filter((row) => row.count > 0);
  const maxLevel = Math.max(...levels.map((row) => row.count), 1);
  const sheets = STATUSES.reduce((total, status) => total + data.resultStatus[status], 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="University reports"
        description={semesterLabel(data.semester)}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        }
      />

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Departments</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Department</TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Lecturers</TableHead>
              <TableHead className="text-right">Courses</TableHead>
              <TableHead className="text-right">Registrations</TableHead>
              <TableHead className="text-right">Average CGPA</TableHead>
              <TableHead className="text-right">Pass rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.departments.map((row) => (
              <TableRow key={row.department.id}>
                <TableCell className="min-w-48 font-medium">{row.department.name}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{row.faculty}</TableCell>
                <TableCell className="text-right tabular-nums">{row.students}</TableCell>
                <TableCell className="text-right tabular-nums">{row.lecturers}</TableCell>
                <TableCell className="text-right tabular-nums">{row.courses}</TableCell>
                <TableCell className="text-right tabular-nums">{row.registrations}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatGpa(row.averageCgpa)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatPercent(row.passRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="font-medium">
                University
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sum("students")}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sum("lecturers")}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sum("courses")}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sum("registrations")}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Students by level</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {levels.map((row) => (
              <div key={row.level} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{row.level}L</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/80" style={{ width: `${(row.count / maxLevel) * 100}%` }} />
                </div>
                <span className="text-right font-medium tabular-nums">{row.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Result sheets this semester</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {STATUSES.map((status) => (
                <li key={status} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <SheetStatusBadge status={status} />
                  <span className="text-sm tabular-nums">
                    <span className="font-medium">{data.resultStatus[status]}</span>
                    <span className="text-muted-foreground"> of {sheets}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
