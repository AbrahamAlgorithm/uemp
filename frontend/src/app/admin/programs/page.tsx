"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { ProgramFormDialog } from "@/components/forms/program-form-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Program } from "@/lib/types";

export default function AdminProgramsPage() {
  const { data, error, reload } = useAsync(() => Promise.all([api.getPrograms(), api.getDepartments()]));
  const [department, setDepartment] = useState("all");
  const [editing, setEditing] = useState<Program | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const [programs, departments] = data;

  const edit = (program: Program | null) => {
    setEditing(program);
    setOpen(true);
  };

  const columns: ColumnDef<Program>[] = [
    {
      id: "name",
      accessorFn: (row) => `${row.award} ${row.name}`,
      header: ({ column }) => <SortHeader column={column} title="Program" />,
      cell: ({ getValue }) => <span className="block min-w-52 font-medium">{getValue<string>()}</span>,
    },
    { id: "department", accessorFn: (row) => row.department.name, header: "Department" },
    { accessorKey: "durationYears", header: "Duration", cell: ({ getValue }) => `${getValue<number>()} years` },
    { id: "levels", accessorFn: (row) => `${row.levels[0]}–${row.levels[row.levels.length - 1]}`, header: "Levels" },
    { accessorKey: "courseCount", header: "Courses" },
    {
      id: "students",
      accessorFn: (row) => row.studentsByLevel.reduce((sum, item) => sum + item.count, 0),
      header: ({ column }) => <SortHeader column={column} title="Students" />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" onClick={() => edit(row.original)} aria-label={`Edit ${row.original.name}`}>
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Programs"
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add program
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={programs.filter((program) => matches(department, program.department.id))}
        searchPlaceholder="Search program"
        emptyTitle="No programs"
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
      <ProgramFormDialog open={open} onOpenChange={setOpen} program={editing} departments={departments} onSaved={reload} />
    </>
  );
}
