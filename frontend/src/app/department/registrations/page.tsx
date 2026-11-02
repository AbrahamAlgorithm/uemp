"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Users } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import type { Registration } from "@/lib/types";

interface CourseGroup {
  key: string;
  course: Registration["course"];
  registrations: Registration[];
}

interface StudentGroup {
  key: string;
  student: Registration["student"];
  registrations: Registration[];
  units: number;
}

function groupBy<K extends string | number>(rows: Registration[], key: (row: Registration) => K) {
  const groups = new Map<K, Registration[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return [...groups.values()];
}

export default function DepartmentRegistrationsPage() {
  const { data, error, reload } = useAsync(api.getRegistrations);
  const [detail, setDetail] = useState<{ title: string; description: string; rows: Registration[]; by: "course" | "student" } | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={3} rows={8} />;

  const byCourse: CourseGroup[] = groupBy(data, (row) => row.course.id).map((rows) => ({
    key: `course-${rows[0]!.course.id}`,
    course: rows[0]!.course,
    registrations: rows,
  }));
  const byStudent: StudentGroup[] = groupBy(data, (row) => row.student.id).map((rows) => ({
    key: `student-${rows[0]!.student.id}`,
    student: rows[0]!.student,
    registrations: rows,
    units: rows.reduce((sum, row) => sum + row.course.units, 0),
  }));
  const averageUnits = byStudent.length ? byStudent.reduce((sum, row) => sum + row.units, 0) / byStudent.length : 0;

  const courseColumns: ColumnDef<CourseGroup>[] = [
    {
      id: "course",
      accessorFn: (row) => `${row.course.code} ${row.course.title}`,
      header: ({ column }) => <SortHeader column={column} title="Course" />,
      cell: ({ row }) => (
        <div className="min-w-48">
          <p className="font-medium">{row.original.course.code}</p>
          <p className="text-xs text-muted-foreground">{row.original.course.title}</p>
        </div>
      ),
    },
    { id: "level", accessorFn: (row) => row.course.level, header: "Level" },
    { id: "units", accessorFn: (row) => row.course.units, header: "Units" },
    { id: "count", accessorFn: (row) => row.registrations.length, header: ({ column }) => <SortHeader column={column} title="Students" /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDetail({
              title: `${row.original.course.code} ${row.original.course.title}`,
              description: `${row.original.registrations.length} registered students`,
              rows: row.original.registrations,
              by: "course",
            })
          }
        >
          View students
        </Button>
      ),
    },
  ];

  const studentColumns: ColumnDef<StudentGroup>[] = [
    {
      id: "matric",
      accessorFn: (row) => row.student.matricNumber,
      header: ({ column }) => <SortHeader column={column} title="Matric no" />,
      cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
    },
    { id: "name", accessorFn: (row) => row.student.fullName, header: ({ column }) => <SortHeader column={column} title="Name" /> },
    { id: "program", accessorFn: (row) => row.student.program, header: "Program" },
    { id: "level", accessorFn: (row) => row.student.level, header: "Level" },
    { id: "courses", accessorFn: (row) => row.registrations.length, header: "Courses" },
    { accessorKey: "units", header: ({ column }) => <SortHeader column={column} title="Units" /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDetail({
              title: row.original.student.fullName,
              description: `${row.original.student.matricNumber} · ${row.original.units} units`,
              rows: row.original.registrations,
              by: "student",
            })
          }
        >
          View courses
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Registrations" description={data[0] ? semesterLabel(data[0].semester) : "This semester"} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Course registrations" value={data.length} icon={ClipboardList} />
        <StatCard label="Students registered" value={byStudent.length} icon={Users} />
        <StatCard label="Average load" value={`${averageUnits.toFixed(1)} units`} icon={ClipboardList} hint="Per registered student" />
      </div>
      <Tabs defaultValue="course">
        <TabsList>
          <TabsTrigger value="course">By course</TabsTrigger>
          <TabsTrigger value="student">By student</TabsTrigger>
        </TabsList>
        <TabsContent value="course" className="mt-4">
          <DataTable columns={courseColumns} data={byCourse} searchPlaceholder="Search course" emptyTitle="No registrations yet" />
        </TabsContent>
        <TabsContent value="student" className="mt-4">
          <DataTable columns={studentColumns} data={byStudent} searchPlaceholder="Search student" emptyTitle="No registrations yet" />
        </TabsContent>
      </Tabs>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>{detail?.description}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                {detail?.by === "course" ? (
                  <>
                    <TableHead>Matric no</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Level</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail?.rows.map((row) =>
                detail.by === "course" ? (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.student.matricNumber}</TableCell>
                    <TableCell>{row.student.fullName}</TableCell>
                    <TableCell>{row.student.level}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.course.code}</TableCell>
                    <TableCell>{row.course.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.course.units}</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
