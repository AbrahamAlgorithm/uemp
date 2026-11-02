"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { DepartmentFormDialog } from "@/components/forms/structure-dialogs";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Department } from "@/lib/types";

export default function DepartmentsPage() {
  const { data, error, reload } = useAsync(() => Promise.all([api.getDepartments(), api.getFaculties()]));
  const [faculty, setFaculty] = useState("all");
  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const [departments, faculties] = data;

  const edit = (department: Department | null) => {
    setEditing(department);
    setOpen(true);
  };

  const columns: ColumnDef<Department>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "name", header: ({ column }) => <SortHeader column={column} title="Name" />, cell: ({ getValue }) => <span className="block min-w-48">{getValue<string>()}</span> },
    { id: "faculty", accessorFn: (row) => row.faculty.name, header: "Faculty" },
    { accessorKey: "programCount", header: "Programs" },
    { accessorKey: "lecturerCount", header: ({ column }) => <SortHeader column={column} title="Lecturers" /> },
    { accessorKey: "studentCount", header: ({ column }) => <SortHeader column={column} title="Students" /> },
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
        title="Departments"
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add department
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={departments.filter((department) => matches(faculty, department.faculty.id))}
        searchPlaceholder="Search department"
        emptyTitle="No departments"
        toolbar={
          <FilterSelect
            label="Faculty"
            value={faculty}
            onChange={setFaculty}
            allLabel="All faculties"
            options={faculties.map((item) => ({ value: item.id, label: item.name }))}
          />
        }
      />
      <DepartmentFormDialog open={open} onOpenChange={setOpen} item={editing} faculties={faculties} onSaved={reload} />
    </>
  );
}
