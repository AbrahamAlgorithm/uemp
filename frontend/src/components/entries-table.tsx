"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, SortHeader } from "@/components/data-table";
import type { ResultEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const columns: ColumnDef<ResultEntry>[] = [
  {
    accessorKey: "matricNumber",
    header: ({ column }) => <SortHeader column={column} title="Matric no" />,
    cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
  },
  {
    accessorKey: "studentName",
    header: ({ column }) => <SortHeader column={column} title="Name" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string>()}</span>,
  },
  { accessorKey: "level", header: "Level" },
  { accessorKey: "ca", header: "CA", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number | null>() ?? "—"}</span> },
  { accessorKey: "exam", header: "Exam", cell: ({ getValue }) => <span className="tabular-nums">{getValue<number | null>() ?? "—"}</span> },
  {
    accessorKey: "total",
    header: ({ column }) => <SortHeader column={column} title="Total" />,
    sortUndefined: "last",
    cell: ({ getValue }) => <span className="font-medium tabular-nums">{getValue<number | null>() ?? "—"}</span>,
  },
  {
    accessorKey: "grade",
    header: "Grade",
    cell: ({ getValue }) => (
      <span className={cn("font-semibold", getValue() === "F" && "text-destructive")}>{getValue<string | null>() ?? "—"}</span>
    ),
  },
];

export function EntriesTable({ entries }: { entries: ResultEntry[] }) {
  return (
    <DataTable
      columns={columns}
      data={entries}
      pageSize={25}
      searchPlaceholder="Search student"
      emptyTitle="No registered students"
      emptyDescription="Students appear here once they register for the course."
    />
  );
}
