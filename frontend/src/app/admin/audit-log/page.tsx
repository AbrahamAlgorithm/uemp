"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { AUDIT_ACTION_LABELS, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { AuditAction, AuditEntry } from "@/lib/types";

const columns: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: "at",
    header: ({ column }) => <SortHeader column={column} title="Time" />,
    cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDateTime(getValue<string>())}</span>,
  },
  {
    id: "actor",
    accessorFn: (row) => row.actor.name,
    header: ({ column }) => <SortHeader column={column} title="User" />,
    cell: ({ row }) => (
      <div className="min-w-40">
        <p>{row.original.actor.name}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[row.original.actor.role]}</p>
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="whitespace-nowrap">
        {AUDIT_ACTION_LABELS[getValue<AuditAction>()]}
      </Badge>
    ),
  },
  { accessorKey: "target", header: "Target", cell: ({ getValue }) => <span className="block max-w-56 min-w-40 break-words whitespace-normal">{getValue<string>()}</span> },
  { accessorKey: "details", header: "Details", cell: ({ getValue }) => <span className="block max-w-sm min-w-52 whitespace-normal text-muted-foreground">{getValue<string>()}</span> },
  { accessorKey: "ipAddress", header: "IP address", cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
];

export default function AuditLogPage() {
  const { data, error, reload } = useAsync(api.getAuditLog);
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={12} />;

  const actors = [...new Map(data.map((entry) => [entry.actor.id, entry.actor])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const actions = [...new Set(data.map((entry) => entry.action))];
  const rows = data.filter((entry) => {
    const day = entry.at.slice(0, 10);
    return (
      matches(actor, entry.actor.id) && matches(action, entry.action) && (!from || day >= from) && (!to || day <= to)
    );
  });

  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in and change made in the portal." />
      <DataTable
        columns={columns}
        data={rows}
        pageSize={20}
        searchPlaceholder="Search target or details"
        emptyTitle="No entries"
        emptyDescription="Nothing matches these filters."
        toolbar={
          <>
            <FilterSelect
              label="User"
              value={actor}
              onChange={setActor}
              allLabel="All users"
              options={actors.map((item) => ({ value: item.id, label: item.name }))}
            />
            <FilterSelect
              label="Action"
              value={action}
              onChange={setAction}
              allLabel="All actions"
              options={actions.map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] }))}
            />
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" className="h-10 w-full rounded-full px-4 sm:w-40" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" className="h-10 w-full rounded-full px-4 sm:w-40" />
          </>
        }
      />
    </>
  );
}
