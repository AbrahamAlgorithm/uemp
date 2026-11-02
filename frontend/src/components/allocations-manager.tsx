"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { FormDialog } from "@/components/form-dialog";
import { SelectField } from "@/components/form-fields";
import { SheetStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { withToast } from "@/lib/toast";
import type { CourseAllocation, Lecturer } from "@/lib/types";

const assignSchema = z.object({ lecturerId: z.number({ error: "Select a lecturer" }) });
type AssignInput = z.infer<typeof assignSchema>;

interface AllocationsManagerProps {
  allocations: CourseAllocation[];
  lecturers: Lecturer[];
  onChanged: () => void;
  showDepartment?: boolean;
}

export function AllocationsManager({ allocations, lecturers, onChanged, showDepartment }: AllocationsManagerProps) {
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [department, setDepartment] = useState("all");
  const [target, setTarget] = useState<CourseAllocation | null>(null);

  const departments = [...new Map(allocations.map((row) => [row.course.department.id, row.course.department])).values()];
  const unassigned = allocations.filter((row) => !row.lecturer).length;
  const rows = allocations.filter(
    (row) => (!unassignedOnly || !row.lecturer) && matches(department, row.course.department.id),
  );

  const columns: ColumnDef<CourseAllocation>[] = [
    {
      id: "course",
      accessorFn: (row) => `${row.course.code} ${row.course.title}`,
      header: ({ column }) => <SortHeader column={column} title="Course" />,
      cell: ({ row }) => (
        <div className="min-w-48">
          <p className="font-medium">{row.original.course.code}</p>
          <p className="text-xs text-muted-foreground">{row.original.course.title}</p>
        </div>
      ),
    },
    ...(showDepartment
      ? [{ id: "department", accessorFn: (row: CourseAllocation) => row.course.department.code, header: "Dept" }]
      : []),
    { id: "level", accessorFn: (row) => row.course.level, header: ({ column }) => <SortHeader column={column} title="Level" /> },
    { id: "units", accessorFn: (row) => row.course.units, header: "Units" },
    { accessorKey: "studentCount", header: "Students" },
    {
      id: "lecturer",
      accessorFn: (row) => row.lecturer?.name ?? "Unassigned",
      header: ({ column }) => <SortHeader column={column} title="Lecturer" />,
      cell: ({ row }) =>
        row.original.lecturer ? (
          <div>
            <p>{row.original.lecturer.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.lecturer.staffId}</p>
          </div>
        ) : (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
            Unassigned
          </Badge>
        ),
    },
    {
      id: "sheet",
      header: "Results",
      cell: ({ row }) => (row.original.sheetStatus ? <SheetStatusBadge status={row.original.sheetStatus} /> : "—"),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const locked = row.original.sheetStatus !== null && row.original.sheetStatus !== "DRAFT";
        const button = (
          <Button
            size="sm"
            variant={row.original.lecturer ? "outline" : "default"}
            disabled={locked}
            onClick={() => setTarget(row.original)}
          >
            {row.original.lecturer ? "Change" : "Assign"}
          </Button>
        );
        return locked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{button}</span>
            </TooltipTrigger>
            <TooltipContent>Results have been submitted for this course</TooltipContent>
          </Tooltip>
        ) : (
          button
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        pageSize={15}
        searchPlaceholder="Search course or lecturer"
        emptyTitle="No courses"
        emptyDescription={unassignedOnly ? "Every course has a lecturer." : "No courses are offered this semester."}
        toolbar={
          <>
            {showDepartment && (
              <FilterSelect
                label="Department"
                value={department}
                onChange={setDepartment}
                allLabel="All departments"
                options={departments.map((row) => ({ value: row.id, label: row.name }))}
              />
            )}
            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Checkbox
                id="unassigned-only"
                checked={unassignedOnly}
                onCheckedChange={(checked) => setUnassignedOnly(checked === true)}
              />
              <Label htmlFor="unassigned-only" className="text-sm font-normal">
                Unassigned only ({unassigned})
              </Label>
            </div>
          </>
        }
      />
      <AssignLecturerDialog
        allocation={target}
        lecturers={lecturers}
        onOpenChange={(open) => !open && setTarget(null)}
        onAssigned={onChanged}
      />
    </>
  );
}

interface AssignLecturerDialogProps {
  allocation: CourseAllocation | null;
  lecturers: Lecturer[];
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

function AssignLecturerDialog({ allocation, lecturers, onOpenChange, onAssigned }: AssignLecturerDialogProps) {
  const form = useForm<AssignInput>({ resolver: zodResolver(assignSchema) });

  useEffect(() => {
    if (allocation) form.reset({ lecturerId: allocation.lecturer?.id });
  }, [allocation, form]);

  if (!allocation) return null;

  const options = lecturers
    .filter((lecturer) => lecturer.status === "ACTIVE" && lecturer.department.id === allocation.course.department.id)
    .map((lecturer) => ({
      value: lecturer.id,
      label: `${lecturer.fullName} (${lecturer.courseCount} ${lecturer.courseCount === 1 ? "course" : "courses"})`,
    }));

  const assign = async ({ lecturerId }: AssignInput) => {
    const name = lecturers.find((lecturer) => lecturer.id === lecturerId)?.fullName ?? "Lecturer";
    const done = await withToast(
      api.assignLecturer(allocation.course.id, lecturerId),
      `${name} assigned to ${allocation.course.code}`,
    );
    if (done) onAssigned();
    return done;
  };

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={`${allocation.lecturer ? "Change" : "Assign"} lecturer`}
      description={`${allocation.course.code} ${allocation.course.title}`}
      form={form}
      onSubmit={assign}
      submitLabel="Assign"
    >
      <SelectField
        control={form.control}
        name="lecturerId"
        label="Lecturer"
        placeholder="Select a lecturer"
        options={options}
        description="Only active lecturers in the course's department are listed."
      />
    </FormDialog>
  );
}
