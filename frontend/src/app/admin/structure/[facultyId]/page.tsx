"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { DeleteDialog, type DeleteTarget } from "@/components/delete-dialog";
import { DepartmentFormDialog } from "@/components/forms/structure-dialogs";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Department } from "@/lib/types";

export default function FacultyPage() {
  const facultyId = Number(useParams<{ facultyId: string }>().facultyId);
  const { data, error, reload } = useAsync(
    () => Promise.all([api.getFaculties(), api.getDepartments(facultyId)]),
    facultyId,
  );
  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={5} />;

  const [faculties, departments] = data;
  const faculty = faculties.find((item) => item.id === facultyId);
  if (!faculty) {
    return (
      <Card>
        <EmptyState title="Faculty not found" description="It may have been deleted." action={<Button asChild><Link href="/admin/structure">Back to faculties</Link></Button>} />
      </Card>
    );
  }

  const edit = (department: Department | null) => {
    setEditing(department);
    setOpen(true);
  };

  const columns: ColumnDef<Department>[] = [
    { accessorKey: "code", header: "Code", cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
    {
      accessorKey: "name",
      header: ({ column }) => <SortHeader column={column} title="Department" />,
      cell: ({ row }) => (
        <Link href={`/admin/structure/${facultyId}/${row.original.id}`} className="block min-w-48 font-medium hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "programCount", header: "Programs" },
    { accessorKey: "lecturerCount", header: ({ column }) => <SortHeader column={column} title="Lecturers" /> },
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
            onClick={() => setDeleting({ noun: "department", name: row.original.name, remove: () => api.deleteDepartment(row.original.id) })}
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
        breadcrumbs={[{ label: "Academic structure", href: "/admin/structure" }, { label: faculty.name }]}
        title={faculty.name}
        description={`${faculty.code} · ${departments.length} ${departments.length === 1 ? "department" : "departments"}`}
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add department
          </Button>
        }
      />
      <DataTable columns={columns} data={departments} searchPlaceholder="Search department" emptyTitle="No departments" emptyDescription="Add the first department in this faculty." />
      <DepartmentFormDialog open={open} onOpenChange={setOpen} item={editing} faculties={faculties} defaultFacultyId={facultyId} onSaved={reload} />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </>
  );
}
