"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Printer } from "lucide-react";

import { DataTable, SortHeader } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge, UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatPercent, formatScore, semesterLabel } from "@/lib/format";
import { GRADES } from "@/lib/grading";
import type { CoursePerformance, Student } from "@/lib/types";

const studentColumns: ColumnDef<Student>[] = [
  {
    accessorKey: "matricNumber",
    header: ({ column }) => <SortHeader column={column} title="Matric no" />,
    cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
  },
  { id: "name", accessorFn: (row) => `${row.lastName} ${row.firstName}`, header: ({ column }) => <SortHeader column={column} title="Name" /> },
  { id: "program", accessorFn: (row) => row.program.name, header: "Program" },
  { accessorKey: "level", header: ({ column }) => <SortHeader column={column} title="Level" /> },
  { accessorKey: "gender", header: "Gender" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <UserStatusBadge status={row.original.status} /> },
];


export default function DepartmentReportsPage() {
  const { data, error, reload } = useAsync(api.getDepartmentReport);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const byLevel = [...new Set(data.students.map((student) => student.level))]
    .sort()
    .map((level) => ({ level, count: data.students.filter((student) => student.level === level).length }));
  const registered = data.registrations.reduce((sum, row) => sum + row.registered, 0);

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${data.department.name} · ${semesterLabel(data.semester)}`}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Print
          </Button>
        }
      />
      <Tabs defaultValue="students">
        <TabsList variant="line" className="print:hidden">
          <TabsTrigger value="students">Student list</TabsTrigger>
          <TabsTrigger value="registrations">Registration report</TabsTrigger>
          <TabsTrigger value="performance">Performance summary</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {byLevel.map((row) => (
              <Card key={row.level} size="sm">
                <CardContent>
                  <p className="text-xs text-muted-foreground">{row.level} level</p>
                  <p className="text-xl font-semibold tabular-nums">{row.count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <DataTable columns={studentColumns} data={data.students} pageSize={100} searchPlaceholder="Search student" />
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <Card size="sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.registrations.map((row) => (
                  <TableRow key={row.course.id}>
                    <TableCell className="font-medium">{row.course.code}</TableCell>
                    <TableCell className="min-w-52">{row.course.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.course.level}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.course.units}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{row.registered}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    {data.registrations.length} courses
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{registered}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-4">
          <PerformanceTable rows={data.performance} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function PerformanceTable({ rows }: { rows: CoursePerformance[] }) {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Courses with scores this semester</CardTitle>
      </CardHeader>
      {rows.length === 0 ? (
        <CardContent className="pb-6 text-sm text-muted-foreground">No scores have been entered yet.</CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">Pass rate</TableHead>
              {GRADES.map((grade) => (
                <TableHead key={grade} className="text-right">
                  {grade}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.course.id}>
                <TableCell className="min-w-44">
                  <p className="font-medium">{row.course.code}</p>
                  <p className="text-xs text-muted-foreground">{row.course.title}</p>
                </TableCell>
                <TableCell>
                  <SheetStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.students}</TableCell>
                <TableCell className="text-right tabular-nums">{formatScore(row.average)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatPercent(row.passRate)}</TableCell>
                {GRADES.map((grade) => (
                  <TableCell key={grade} className="text-right text-muted-foreground tabular-nums">
                    {row.distribution[grade]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
