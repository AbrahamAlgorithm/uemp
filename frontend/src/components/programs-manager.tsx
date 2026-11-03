"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { DeleteDialog, type DeleteTarget } from "@/components/delete-dialog";
import { ProgramFormDialog } from "@/components/forms/program-form-dialog";
import { useSession } from "@/components/session-provider";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Program } from "@/lib/types";

// departmentId is only given where a super admin looks at one department; admins are scoped by the api
export function ProgramsManager({ departmentId }: { departmentId?: number }) {
  const { user } = useSession();
  const { data, error, reload } = useAsync(() => api.getPrograms(departmentId), departmentId ?? "own");
  const [editing, setEditing] = useState<Program | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;

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
    { accessorKey: "durationYears", header: "Duration", cell: ({ getValue }) => `${getValue<number>()} years` },
    { accessorKey: "courseCount", header: ({ column }) => <SortHeader column={column} title="Courses" /> },
    {
      id: "students",
      accessorFn: (row) => row.studentsByLevel.reduce((sum, item) => sum + item.count, 0),
      header: ({ column }) => <SortHeader column={column} title="Students" />,
    },
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
            onClick={() =>
              setDeleting({ noun: "program", name: row.original.name, remove: () => api.deleteProgram(row.original.id) })
            }
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search program"
        emptyTitle="No programs"
        emptyDescription="Add the degree programs this department offers."
        toolbar={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add program
          </Button>
        }
      />
      <ProgramFormDialog
        open={open}
        onOpenChange={setOpen}
        program={editing}
        defaultDepartmentId={departmentId ?? user?.department?.id}
        onSaved={reload}
      />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </>
  );
}
