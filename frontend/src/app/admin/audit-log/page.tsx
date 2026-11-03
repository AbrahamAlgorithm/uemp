"use client";

import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { AuditDetail } from "@/components/audit-detail";
import { FilterSelect } from "@/components/filter-select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { auditActionLabel, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { AuditRow } from "@/lib/types";

const PAGE_SIZE = 20;
const FIELD = "h-10 w-full rounded-full px-4 sm:w-40";

const EMPTY = { actor: "all", action: "all", entityType: "all", department: "all", dateFrom: "", dateTo: "", search: "" };

export default function AuditLogPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditRow | null>(null);

  const options = useAsync(() => Promise.all([api.getAuditFilters(), api.getDepartments()]));
  const query = {
    page,
    actor: filters.actor === "all" ? undefined : filters.actor,
    action: filters.action === "all" ? undefined : filters.action,
    entityType: filters.entityType === "all" ? undefined : filters.entityType,
    department: filters.department === "all" ? undefined : filters.department,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    search: filters.search || undefined,
  };
  const log = useAsync(() => api.getAuditLog(query), JSON.stringify(query));

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => (current.search === search ? current : { ...current, search }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const set = (name: keyof typeof EMPTY) => (value: string) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  };

  const error = options.error ?? log.error;
  if (error) return <ErrorState error={error} onRetry={() => (options.error ? options.reload() : log.reload())} />;
  if (!options.data || !log.data) return <PageSkeleton rows={12} />;

  const [choices, departments] = options.data;
  const pages = Math.max(1, Math.ceil(log.data.count / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in and change made in the portal. Open a row to see what changed." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search target or details"
            aria-label="Search target or details"
            className="h-10 rounded-full pl-10"
          />
        </div>
        <FilterSelect
          label="User"
          value={filters.actor}
          onChange={set("actor")}
          allLabel="All users"
          options={choices.actors.map((item) => ({ value: item.id, label: item.name }))}
        />
        <FilterSelect
          label="Action"
          value={filters.action}
          onChange={set("action")}
          allLabel="All actions"
          options={choices.actions.map((value) => ({ value, label: auditActionLabel(value) }))}
        />
        <FilterSelect
          label="Record type"
          value={filters.entityType}
          onChange={set("entityType")}
          allLabel="All record types"
          options={choices.entityTypes.map((value) => ({ value, label: value }))}
        />
        <FilterSelect
          label="Department"
          value={filters.department}
          onChange={set("department")}
          allLabel="All departments"
          options={departments.map((item) => ({ value: item.id, label: item.name }))}
        />
        <Input type="date" value={filters.dateFrom} onChange={(event) => set("dateFrom")(event.target.value)} aria-label="From date" className={FIELD} />
        <Input type="date" value={filters.dateTo} onChange={(event) => set("dateTo")(event.target.value)} aria-label="To date" className={FIELD} />
      </div>

      <Card className="py-0">
        {log.data.results.length === 0 ? (
          <EmptyState icon={ScrollText} title="No entries" description="Nothing matches these filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data.results.map((entry) => (
                <TableRow
                  key={entry.id}
                  tabIndex={0}
                  role="button"
                  className="cursor-pointer"
                  onClick={() => setOpen(entry)}
                  onKeyDown={(event) => event.key === "Enter" && setOpen(entry)}
                >
                  <TableCell className="whitespace-nowrap">{formatDateTime(entry.at)}</TableCell>
                  <TableCell className="min-w-40">
                    <p>{entry.actor?.name ?? (entry.actorEmail || "—")}</p>
                    {entry.actor && <p className="text-xs text-muted-foreground">{ROLE_LABELS[entry.actor.role]}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="whitespace-nowrap">
                      {auditActionLabel(entry.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-64 min-w-40 break-words whitespace-normal">{entry.target || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{entry.department?.code ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <p className="tabular-nums">
          {log.data.count} {log.data.count === 1 ? "entry" : "entries"}
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Next page">
            <ChevronRight />
          </Button>
        </nav>
      </div>

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{open ? auditActionLabel(open.action) : ""}</SheetTitle>
            <SheetDescription>{open?.target}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{open && <AuditDetail id={open.id} />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
