"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FacultyFormDialog } from "@/components/forms/structure-dialogs";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Faculty } from "@/lib/types";

export default function FacultiesPage() {
  const { data, error, reload } = useAsync(api.getFaculties);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

  const edit = (faculty: Faculty | null) => {
    setEditing(faculty);
    setOpen(true);
  };

  const columns: ColumnDef<Faculty>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    { accessorKey: "name", header: ({ column }) => <SortHeader column={column} title="Name" /> },
    { accessorKey: "departmentCount", header: ({ column }) => <SortHeader column={column} title="Departments" /> },
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
        title="Faculties"
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add faculty
          </Button>
        }
      />
      <DataTable columns={columns} data={data} searchPlaceholder="Search faculty" emptyTitle="No faculties" />
      <FacultyFormDialog open={open} onOpenChange={setOpen} item={editing} onSaved={reload} />
    </>
  );
}
