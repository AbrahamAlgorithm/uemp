"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { DeleteDialog, type DeleteTarget } from "@/components/delete-dialog";
import { CourseFormDialog } from "@/components/forms/course-form-dialog";
import { useSession } from "@/components/session-provider";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { LEVELS } from "@/lib/constants";
import type { Course, Level } from "@/lib/types";

export function CoursesManager({ departmentId }: { departmentId?: number }) {
  const { user } = useSession();
  const { data, error, reload } = useAsync(
    () => Promise.all([api.getCourses(departmentId), api.getPrograms(departmentId)]),
    departmentId ?? "own",
  );
  const [level, setLevel] = useState<Level>(100);
  const [editing, setEditing] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const [courses, programs] = data;
  const edit = (course: Course | null) => {
    setEditing(course);
    setOpen(true);
  };

  const columns: ColumnDef<Course>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => <SortHeader column={column} title="Code" />,
      cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <SortHeader column={column} title="Title" />,
      cell: ({ getValue }) => <span className="block min-w-52">{getValue<string>()}</span>,
    },
    { accessorKey: "units", header: "Units" },
    { accessorKey: "semester", header: "Semester", cell: ({ getValue }) => (getValue() === "FIRST" ? "First" : "Second") },
    {
      id: "programs",
      accessorFn: (row) => row.programs.map((program) => program.name).join(", "),
      header: "Available to",
      cell: ({ getValue }) => (
        <span className="block max-w-64 min-w-40 text-xs whitespace-normal text-muted-foreground">{getValue<string>()}</span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => edit(row.original)} aria-label={`Edit ${row.original.code}`}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${row.original.code}`}
            onClick={() => setDeleting({ noun: "course", name: row.original.code, remove: () => api.deleteCourse(row.original.id) })}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Tabs value={String(level)} onValueChange={(value) => setLevel(Number(value) as Level)}>
        <TabsList variant="line">
          {LEVELS.map((item) => (
            <TabsTrigger key={item} value={String(item)}>
              {item} level
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                {courses.filter((course) => course.level === item).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {LEVELS.map((item) => (
          <TabsContent key={item} value={String(item)} className="mt-4">
            <DataTable
              columns={columns}
              data={courses.filter((course) => course.level === item)}
              pageSize={15}
              searchPlaceholder="Search code or title"
              emptyTitle={`No ${item} level courses`}
              emptyDescription="Add a course to offer it to students at this level."
              toolbar={
                <Button onClick={() => edit(null)} disabled={programs.length === 0}>
                  <Plus />
                  Add {item} level course
                </Button>
              }
            />
          </TabsContent>
        ))}
      </Tabs>
      <CourseFormDialog
        open={open}
        onOpenChange={setOpen}
        course={editing}
        programs={programs}
        defaultDepartmentId={departmentId ?? user?.department?.id}
        defaultLevel={level}
        onSaved={reload}
      />
      <DeleteDialog target={deleting} onClose={() => setDeleting(null)} onDeleted={reload} />
    </>
  );
}
