"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Gauge, Users } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate, semesterLabel } from "@/lib/format";
import type { Registration } from "@/lib/types";


const columns: ColumnDef<Registration>[] = [
  {
    id: "student",
    accessorFn: (row) => `${row.student.fullName} ${row.student.matricNumber}`,
    header: ({ column }) => <SortHeader column={column} title="Student" />,
    cell: ({ row }) => (
      <div className="min-w-44">
        <p>{row.original.student.fullName}</p>
        <p className="text-xs text-muted-foreground">{row.original.student.matricNumber}</p>
      </div>
    ),
  },
  { id: "level", accessorFn: (row) => row.student.level, header: "Level" },
  {
    id: "course",
    accessorFn: (row) => `${row.course.code} ${row.course.title}`,
    header: ({ column }) => <SortHeader column={column} title="Course" />,
    cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.course.code}</span>,
  },
  { id: "department", accessorFn: (row) => row.course.department.code, header: "Dept" },
  { id: "units", accessorFn: (row) => row.course.units, header: "Units" },
  {
    accessorKey: "registeredAt",
    header: ({ column }) => <SortHeader column={column} title="Registered" />,
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.registeredAt)}</span>,
  },
];

export default function AdminRegistrationsPage() {
  const { data, error, reload } = useAsync(() =>
    Promise.all([api.getRegistrations(), api.getStudents(), api.getDepartments(), api.getCurrentSemester()]),
  );
  const [department, setDepartment] = useState("all");

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={3} rows={10} />;

  const [registrations, students, departments, semester] = data;
  const registeredStudents = new Set(registrations.map((row) => row.student.id));
  const active = students.filter((student) => student.status === "ACTIVE");
  const totalUnits = registrations.reduce((sum, row) => sum + row.course.units, 0);

  const perDepartment = departments.map((item) => {
    const own = active.filter((student) => student.department.id === item.id);
    const registered = own.filter((student) => registeredStudents.has(student.id));
    const rows = registrations.filter((row) => row.course.department.id === item.id);
    return { department: item, students: own.length, registered: registered.length, registrations: rows.length };
  });

  return (
    <>
      <PageHeader title="Registration monitoring" description={semesterLabel(semester)} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Course registrations" tone="blue" value={registrations.length} icon={ClipboardList} />
        <StatCard
          label="Students registered" tone="orange"
          value={`${registeredStudents.size} / ${active.length}`}
          icon={Users}
          hint="Active students with at least one course"
        />
        <StatCard
          label="Average load" tone="green"
          value={`${registeredStudents.size ? (totalUnits / registeredStudents.size).toFixed(1) : "0"} units`}
          icon={Gauge}
          hint="Per registered student"
        />
      </div>

      <Card className="mb-6 pb-0">
        <CardHeader>
          <CardTitle>By department</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Active students</TableHead>
              <TableHead className="text-right">Registered</TableHead>
              <TableHead className="text-right">Not yet registered</TableHead>
              <TableHead className="text-right">Course registrations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {perDepartment.map((row) => (
              <TableRow key={row.department.id}>
                <TableCell className="font-medium">{row.department.name}</TableCell>
                <TableCell className="text-right tabular-nums">{row.students}</TableCell>
                <TableCell className="text-right tabular-nums">{row.registered}</TableCell>
                <TableCell className="text-right tabular-nums">{row.students - row.registered}</TableCell>
                <TableCell className="text-right tabular-nums">{row.registrations}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DataTable
        columns={columns}
        data={registrations.filter((row) => matches(department, row.course.department.id))}
        pageSize={15}
        searchPlaceholder="Search student or course"
        emptyTitle="No registrations yet"
        initialSorting={[{ id: "registeredAt", desc: true }]}
        toolbar={
          <FilterSelect
            label="Department"
            value={department}
            onChange={setDepartment}
            allLabel="All departments"
            options={departments.map((item) => ({ value: item.id, label: item.name }))}
          />
        }
      />
    </>
  );
}
