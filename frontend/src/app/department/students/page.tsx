"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { StudentFormDialog } from "@/components/forms/student-form-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Student } from "@/lib/types";

export default function DepartmentStudentsPage() {
  const { data, error, reload } = useAsync(() => Promise.all([api.getStudents(), api.getPrograms()]));
  const [level, setLevel] = useState("all");
  const [program, setProgram] = useState("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const [students, programs] = data;
  const levels = [...new Set(students.map((student) => student.level))].sort();
  const rows = students.filter((student) => matches(level, student.level) && matches(program, student.program.id));

  const edit = (student: Student | null) => {
    setEditing(student);
    setOpen(true);
  };

  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: "matricNumber",
      header: ({ column }) => <SortHeader column={column} title="Matric no" />,
      cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
    },
    {
      id: "name",
      accessorFn: (row) => `${row.lastName} ${row.firstName} ${row.email}`,
      header: ({ column }) => <SortHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="min-w-48">
          <p>
            {row.original.lastName} {row.original.firstName}
          </p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    { id: "program", accessorFn: (row) => row.program.name, header: "Program" },
    { accessorKey: "level", header: ({ column }) => <SortHeader column={column} title="Level" /> },
    { accessorKey: "phone", header: "Phone", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <UserStatusBadge status={row.original.status} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" onClick={() => edit(row.original)} aria-label={`Edit ${row.original.fullName}`}>
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Students"
        description={`${students.length} students in the department`}
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add student
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search name, matric or email"
        emptyTitle="No students"
        emptyDescription="Students you add will appear here."
        toolbar={
          <>
            <FilterSelect
              label="Program"
              value={program}
              onChange={setProgram}
              allLabel="All programs"
              options={programs.map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Level"
              value={level}
              onChange={setLevel}
              allLabel="All levels"
              options={levels.map((value) => ({ value, label: `${value} level` }))}
            />
          </>
        }
      />
      <StudentFormDialog open={open} onOpenChange={setOpen} student={editing} programs={programs} onSaved={reload} />
    </>
  );
}
