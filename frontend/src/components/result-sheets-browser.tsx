"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SHEET_STATUS_LABELS } from "@/lib/constants";
import { formatDate, semesterLabel } from "@/lib/format";
import type { ResultSheetSummary, SheetStatus } from "@/lib/types";

const STATUS_TABS: SheetStatus[] = ["SUBMITTED", "REJECTED", "DRAFT", "APPROVED"];

interface ResultSheetsBrowserProps {
  sheets: ResultSheetSummary[];
  reviewHref?: (sheet: ResultSheetSummary) => string;
  showDepartment?: boolean;
}

export function ResultSheetsBrowser({ sheets, reviewHref, showDepartment }: ResultSheetsBrowserProps) {
  const semesters = useMemo(
    () => [...new Map(sheets.map((sheet) => [sheet.semester.id, sheet.semester])).values()].sort((a, b) => b.id - a.id),
    [sheets],
  );
  const departments = useMemo(
    () => [...new Map(sheets.map((sheet) => [sheet.department.id, sheet.department])).values()],
    [sheets],
  );
  const [status, setStatus] = useState<SheetStatus | "all">("SUBMITTED");
  const [semester, setSemester] = useState(String(semesters.find((row) => row.isCurrent)?.id ?? "all"));
  const [department, setDepartment] = useState("all");

  const inFilters = sheets.filter(
    (sheet) => matches(semester, sheet.semester.id) && matches(department, sheet.department.id),
  );
  const rows = inFilters.filter((sheet) => status === "all" || sheet.status === status);
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
    { id: "lecturer", accessorFn: (row) => row.lecturer.name, header: "Lecturer" },
    { id: "semester", accessorFn: (row) => semesterLabel(row.semester), header: "Semester" },
    { accessorKey: "studentCount", header: "Students", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <SheetStatusBadge status={row.original.status} /> },
    {
      accessorKey: "submittedAt",
      header: ({ column }) => <SortHeader column={column} title="Submitted" />,
      cell: ({ row }) => formatDate(row.original.submittedAt),
    },
    ...(reviewHref
      ? [
          {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }: { row: { original: ResultSheetSummary } }) => (
              <Button variant={row.original.status === "SUBMITTED" ? "default" : "outline"} size="sm" asChild>
                <Link href={reviewHref(row.original)}>{row.original.status === "SUBMITTED" ? "Review" : "View"}</Link>
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search course or lecturer"
      emptyTitle="No result sheets"
      emptyDescription="Nothing matches these filters."
      leading={
        <Tabs value={status} onValueChange={(value) => setStatus(value as SheetStatus | "all")}>
          <TabsList>
            {STATUS_TABS.map((value) => (
              <TabsTrigger key={value} value={value}>
                {value === "SUBMITTED" ? "Pending" : SHEET_STATUS_LABELS[value]}
                <span className="ml-1 text-xs tabular-nums opacity-60">{count(value)}</span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="all">
              All <span className="ml-1 text-xs tabular-nums opacity-60">{inFilters.length}</span>
            </TabsTrigger>
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
