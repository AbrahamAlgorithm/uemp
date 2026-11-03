"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { Crumb } from "@/components/breadcrumbs";
import { DataTable, SortHeader } from "@/components/data-table";
import { StudentFormDialog } from "@/components/forms/student-form-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Level, Student } from "@/lib/types";

interface StudentLevelListProps {
  level: Level;
  departmentId?: number;
  hrefFor: (student: Student) => string;
  breadcrumbs: Crumb[];
}

export function StudentLevelList({ level, departmentId, hrefFor, breadcrumbs }: StudentLevelListProps) {
  const { data, error, reload } = useAsync(
    () => Promise.all([api.getStudents({ departmentId, level }), api.getPrograms(departmentId)]),
    `${departmentId}-${level}`,
  );
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const [students, programs] = data;
  const edit = (student: Student | null) => {
    setEditing(student);
    setOpen(true);
  };

  const columns: ColumnDef<Student>[] = [
    {
      accessorKey: "matricNumber",
      header: ({ column }) => <SortHeader column={column} title="Matric no" />,
      cell: ({ row }) => (
        <Link href={hrefFor(row.original)} className="font-medium whitespace-nowrap hover:underline">
          {row.original.matricNumber}
        </Link>
      ),
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
    { accessorKey: "entrySession", header: "Entry session" },
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
        breadcrumbs={breadcrumbs}
        title={`${level} level students`}
        description={`${students.length} ${students.length === 1 ? "student" : "students"}`}
        actions={
          <Button onClick={() => edit(null)} disabled={programs.length === 0}>
            <Plus />
            Add student
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={students}
        searchPlaceholder="Search name, matric or email"
        emptyTitle="No students at this level"
        emptyDescription="Students you add will appear here."
      />
      <StudentFormDialog open={open} onOpenChange={setOpen} student={editing} programs={programs} defaultLevel={level} onSaved={reload} />
    </>
  );
}
