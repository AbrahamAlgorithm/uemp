"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { CourseFormDialog } from "@/components/forms/course-form-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LEVELS } from "@/lib/constants";
import type { CodedRef, Course, Program } from "@/lib/types";

interface CoursesManagerProps {
  courses: Course[];
  programs: Program[];
  onChanged: () => void;
  departments?: CodedRef[];
  defaultDepartmentId?: number;
}

export function CoursesManager({ courses, programs, onChanged, departments, defaultDepartmentId }: CoursesManagerProps) {
  const [level, setLevel] = useState("all");
  const [semester, setSemester] = useState("all");
  const [department, setDepartment] = useState("all");
  const [editing, setEditing] = useState<Course | null>(null);
  const [open, setOpen] = useState(false);

  const rows = courses.filter(
    (course) => matches(level, course.level) && matches(semester, course.semester) && matches(department, course.department.id),
  );

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
    { accessorKey: "title", header: ({ column }) => <SortHeader column={column} title="Title" />, cell: ({ getValue }) => <span className="block min-w-52">{getValue<string>()}</span> },
    ...(departments ? [{ id: "department", accessorFn: (row: Course) => row.department.code, header: "Dept" }] : []),
    { accessorKey: "units", header: "Units" },
    { accessorKey: "level", header: ({ column }) => <SortHeader column={column} title="Level" /> },
    { accessorKey: "semester", header: "Semester", cell: ({ getValue }) => (getValue() === "FIRST" ? "First" : "Second") },
    {
      id: "programs",
      accessorFn: (row) => row.programs.map((program) => program.name).join(", "),
      header: "Available to",
      cell: ({ getValue }) => <span className="block max-w-64 min-w-40 text-xs whitespace-normal text-muted-foreground">{getValue<string>()}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <Button variant="ghost" size="icon-sm" onClick={() => edit(row.original)} aria-label={`Edit ${row.original.code}`}>
          <Pencil />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Courses"
        description={`${courses.length} courses`}
        actions={
          <Button onClick={() => edit(null)}>
            <Plus />
            Add course
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        pageSize={15}
        searchPlaceholder="Search code or title"
        emptyTitle="No courses"
        toolbar={
          <>
            {departments && (
              <FilterSelect
                label="Department"
                value={department}
                onChange={setDepartment}
                allLabel="All departments"
                options={departments.map((item) => ({ value: item.id, label: item.name }))}
              />
            )}
            <FilterSelect
              label="Level"
              value={level}
              onChange={setLevel}
              allLabel="All levels"
              options={LEVELS.map((value) => ({ value, label: `${value} level` }))}
            />
            <FilterSelect
              label="Semester"
              value={semester}
              onChange={setSemester}
              allLabel="Both semesters"
              options={[
                { value: "FIRST", label: "First" },
                { value: "SECOND", label: "Second" },
              ]}
            />
          </>
        }
      />
      <CourseFormDialog
        open={open}
        onOpenChange={setOpen}
        course={editing}
        programs={programs}
        departments={departments}
        defaultDepartmentId={defaultDepartmentId}
        onSaved={onChanged}
      />
    </>
  );
}
