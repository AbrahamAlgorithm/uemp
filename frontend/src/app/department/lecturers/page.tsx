"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { LecturerFormDialog } from "@/components/forms/lecturer-form-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Lecturer } from "@/lib/types";

export default function DepartmentLecturersPage() {
  const { data, error, reload } = useAsync(api.getLecturers);
  const [editing, setEditing] = useState<Lecturer | null>(null);
  const [open, setOpen] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const edit = (lecturer: Lecturer | null) => {
    setEditing(lecturer);
    setOpen(true);
  };

  const columns: ColumnDef<Lecturer>[] = [
    {
      accessorKey: "staffId",
      header: "Staff ID",
      cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
    },
    {
      id: "name",
      accessorFn: (row) => `${row.lastName} ${row.firstName} ${row.email}`,
      header: ({ column }) => <SortHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="min-w-48">
          <p>{row.original.fullName}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "courseCount", header: ({ column }) => <SortHeader column={column} title="Courses" /> },
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
        title="Lecturers"
        description="Course counts are for the current semester."
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add lecturer
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search name, staff ID or email"
        emptyTitle="No lecturers"
        emptyDescription="Lecturers you add will appear here."
      />
      <LecturerFormDialog open={open} onOpenChange={setOpen} lecturer={editing} onSaved={reload} />
    </>
  );
}
