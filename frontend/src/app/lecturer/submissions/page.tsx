"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

import { DataTable, SortHeader } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { formatDate, semesterLabel } from "@/lib/format";
import type { ResultSheetSummary } from "@/lib/types";

const columns: ColumnDef<ResultSheetSummary>[] = [
  {
    id: "course",
    accessorFn: (row) => `${row.course.code} ${row.course.title}`,
    header: ({ column }) => <SortHeader column={column} title="Course" />,
    cell: ({ row }) => (
      <Link href={`/lecturer/courses/${row.original.allocationId}/scores`} className="block min-w-48 hover:underline">
        <span className="font-medium">{row.original.course.code}</span>
        <span className="block text-xs text-muted-foreground">{row.original.course.title}</span>
      </Link>
    ),
  },
  { id: "semester", accessorFn: (row) => semesterLabel(row.semester), header: "Semester", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span> },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <SheetStatusBadge status={row.original.status} /> },
  {
    accessorKey: "submittedAt",
    header: ({ column }) => <SortHeader column={column} title="Submitted" />,
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.submittedAt)}</span>,
  },
  { accessorKey: "reviewedAt", header: "Reviewed", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.reviewedAt)}</span> },
  {
    accessorKey: "feedback",
    header: "Department feedback",
    cell: ({ row }) =>
      row.original.feedback ? (
        <p className="max-w-md min-w-56 text-sm whitespace-normal">{row.original.feedback}</p>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

export default function SubmissionsPage() {
  const { data, error, reload } = useAsync(api.getMySubmissions);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  return (
    <>
      <PageHeader title="Submissions" description="Every result sheet you've submitted, with the department's response." />
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search course"
        emptyTitle="No submissions yet"
        emptyDescription="Result sheets appear here after you submit them."
      />
    </>
  );
}
