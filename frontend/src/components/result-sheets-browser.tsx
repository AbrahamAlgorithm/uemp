"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, semesterLabel } from "@/lib/format";
import type { ResultSheetSummary, SheetStatus } from "@/lib/types";

const STATUS_TABS: { status: SheetStatus; label: string }[] = [
  { status: "SUBMITTED", label: "Pending review" },
  { status: "REJECTED", label: "Rejected" },
  { status: "APPROVED", label: "Approved" },
  { status: "DRAFT", label: "Draft" },
];

interface ResultSheetsBrowserProps {
  sheets: ResultSheetSummary[];
  reviewHref: (sheet: ResultSheetSummary) => string;
  canApprove?: boolean;
  showDepartment?: boolean;
}

export function ResultSheetsBrowser({ sheets, reviewHref, canApprove, showDepartment }: ResultSheetsBrowserProps) {
  const semesters = useMemo(
    () => [...new Map(sheets.map((sheet) => [sheet.semester.id, sheet.semester])).values()].sort((a, b) => b.id - a.id),
    [sheets],
  );
  const departments = useMemo(
    () => [...new Map(sheets.map((sheet) => [sheet.department.id, sheet.department])).values()],
    [sheets],
  );
  const [status, setStatus] = useState<SheetStatus>("SUBMITTED");
  const [semester, setSemester] = useState(String(semesters.find((row) => row.isCurrent)?.id ?? "all"));
  const [department, setDepartment] = useState("all");

  const inFilters = sheets.filter(
    (sheet) => matches(semester, sheet.semester.id) && matches(department, sheet.department.id),
  );
  const rows = inFilters.filter((sheet) => sheet.status === status);
  const count = (value: SheetStatus) => inFilters.filter((sheet) => sheet.status === value).length;

  const columns: ColumnDef<ResultSheetSummary>[] = [
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
      ? [{ id: "department", accessorFn: (row: ResultSheetSummary) => row.department.code, header: "Dept" }]
      : []),
    { id: "lecturer", accessorFn: (row) => row.lecturer?.name ?? "Unassigned", header: "Lecturer" },
    { id: "semester", accessorFn: (row) => semesterLabel(row.semester), header: "Semester" },
    {
      id: "scored",
      accessorFn: (row) => row.studentCount,
      header: "Scored",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.scoredCount} of {row.original.studentCount}
        </span>
      ),
    },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <SheetStatusBadge status={row.original.status} /> },
    {
      accessorKey: "submittedAt",
      header: ({ column }) => <SortHeader column={column} title="Submitted" />,
      cell: ({ row }) => formatDate(row.original.submittedAt),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const review = canApprove && row.original.status === "SUBMITTED";
        return (
          <Button variant={review ? "default" : "outline"} size="sm" asChild>
            <Link href={reviewHref(row.original)}>{review ? "Review" : "View"}</Link>
          </Button>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search course or lecturer"
      emptyTitle="No result sheets"
      emptyDescription="Nothing matches these filters."
      leading={
        <Tabs value={status} onValueChange={(value) => setStatus(value as SheetStatus)}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.status} value={tab.status}>
                {tab.label}
                <span className="ml-1 text-xs tabular-nums opacity-60">{count(tab.status)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
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
          <FilterSelect
            label="Semester"
            value={semester}
            onChange={setSemester}
            allLabel="All semesters"
            options={semesters.map((row) => ({ value: row.id, label: semesterLabel(row) }))}
          />
        </>
      }
    />
  );
}
