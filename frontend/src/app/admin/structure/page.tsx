"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { DeleteDialog, type DeleteTarget } from "@/components/delete-dialog";
import { FacultyFormDialog } from "@/components/forms/structure-dialogs";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Faculty } from "@/lib/types";

export default function AcademicStructurePage() {
  const { data, error, reload } = useAsync(api.getFaculties);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

  const edit = (faculty: Faculty | null) => {
    setEditing(faculty);
    setOpen(true);
  };

  const columns: ColumnDef<Faculty>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    {
      accessorKey: "name",
      header: ({ column }) => <SortHeader column={column} title="Faculty" />,
      cell: ({ row }) => (
        <Link href={`/admin/structure/${row.original.id}`} className="block min-w-48 font-medium hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "departmentCount", header: ({ column }) => <SortHeader column={column} title="Departments" /> },
    { accessorKey: "studentCount", header: ({ column }) => <SortHeader column={column} title="Students" /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => edit(row.original)} aria-label={`Edit ${row.original.name}`}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${row.original.name}`}
            onClick={() => setDeleting({ noun: "faculty", name: row.original.name, remove: () => api.deleteFaculty(row.original.id) })}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Academic structure"
        description="Faculties, their departments, and everything a department runs."
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add faculty
          </Button>
        }
      />
      <DataTable columns={columns} data={data} searchPlaceholder="Search faculty" emptyTitle="No faculties" />
      <FacultyFormDialog open={open} onOpenChange={setOpen} item={editing} onSaved={reload} />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </>
  );
}
