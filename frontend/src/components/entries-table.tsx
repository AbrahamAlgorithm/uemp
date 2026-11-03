"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, SortHeader } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import type { ResultEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const score = (value: number | null) => <span className="tabular-nums">{value ?? "—"}</span>;

const columns: ColumnDef<ResultEntry>[] = [
  {
    accessorKey: "matricNumber",
    header: ({ column }) => <SortHeader column={column} title="Matric no" />,
    cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue<string>()}</span>,
  },
  {
    accessorKey: "studentName",
    header: ({ column }) => <SortHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <span className="flex items-center gap-2 whitespace-nowrap">
        {row.original.studentName}
        {row.original.isCarryOver && (
          <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
            Carry-over
          </Badge>
        )}
      </span>
    ),
  },
  { id: "department", accessorFn: (row) => row.department.code, header: "Dept" },
  { accessorKey: "ca", header: "CA", cell: ({ getValue }) => score(getValue<number | null>()) },
  { accessorKey: "exam", header: "Exam", cell: ({ getValue }) => score(getValue<number | null>()) },
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
      emptyTitle="No students on the class list"
      emptyDescription="Students appear here once their department validates their registration."
    />
  );
}
