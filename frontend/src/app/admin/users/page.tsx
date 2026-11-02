"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useState } from "react";

import { DataTable, SortHeader } from "@/components/data-table";
import { FilterSelect, matches } from "@/components/filter-select";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { UserStatusBadge } from "@/components/status-badge";
import { UserActions } from "@/components/user-actions";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Role, UserAccount, UserStatus } from "@/lib/types";

export default function UsersPage() {
  const { data, error, reload } = useAsync(() => Promise.all([api.getUsers(), api.getDepartments()]));
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const [users, departments] = data;

  const columns: ColumnDef<UserAccount>[] = [
    {
      id: "name",
      accessorFn: (row) => `${row.fullName} ${row.email}`,
      header: ({ column }) => <SortHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <Link href={`/admin/users/${row.original.id}`} className="block min-w-52 hover:underline">
          <span className="font-medium">{row.original.fullName}</span>
          <span className="block text-xs text-muted-foreground">{row.original.email}</span>
        </Link>
      ),
    },
    { accessorKey: "identifier", header: "ID", cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue<string | null>() ?? "—"}</span> },
    { accessorKey: "role", header: "Role", cell: ({ getValue }) => <span className="whitespace-nowrap">{ROLE_LABELS[getValue<Role>()]}</span> },
    { id: "department", accessorFn: (row) => row.department?.code ?? "—", header: "Dept" },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <UserStatusBadge status={row.original.status} /> },
    {
      accessorKey: "lastLogin",
      header: ({ column }) => <SortHeader column={column} title="Last sign-in" />,
      sortUndefined: "last",
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.lastLogin)}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <UserActions user={row.original} departments={departments} onChanged={reload} showView />,
    },
  ];

  return (
    <>
      <PageHeader title="Users" description={`${users.length} accounts across the university`} />
      <DataTable
        columns={columns}
        data={users.filter((user) => matches(role, user.role) && matches(status, user.status))}
        pageSize={15}
        searchPlaceholder="Search name, email or ID"
        emptyTitle="No users"
        toolbar={
          <>
            <FilterSelect
              label="Role"
              value={role}
              onChange={setRole}
              allLabel="All roles"
              options={(Object.keys(ROLE_LABELS) as Role[]).map((value) => ({ value, label: ROLE_LABELS[value] }))}
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              allLabel="Any status"
              options={(Object.keys(USER_STATUS_LABELS) as UserStatus[]).map((value) => ({
                value,
                label: USER_STATUS_LABELS[value],
              }))}
            />
          </>
        }
      />
    </>
  );
}
