"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  leading?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  initialSorting?: SortingState;
  searchable?: boolean;
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Search",
  toolbar,
  leading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  pageSize = 10,
  initialSorting = [],
  searchable = true,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const first = total === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min(total, (pageIndex + 1) * pageSize);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)] sm:p-5">
      {(searchable || toolbar || leading) && (
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center print:hidden">
          {leading && <div className="-mx-1 overflow-x-auto px-1">{leading}</div>}
          <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", leading ? "xl:ml-auto" : "flex-1")}>
            {searchable && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-10 rounded-full pl-10"
                />
              </div>
            )}
            {toolbar && <div className={cn("flex flex-wrap items-center gap-2", !leading && "sm:ml-auto")}>{toolbar}</div>}
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="whitespace-normal">
                <EmptyState
                  title={globalFilter ? "No matches" : emptyTitle}
                  description={globalFilter ? `Nothing matches "${globalFilter}".` : emptyDescription}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {total > 0 && (
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="tabular-nums">
            Showing {first === last ? first : `${first}–${last}`} of {total}
          </p>
          {table.getPageCount() > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1.5">
              <PageButton onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </PageButton>
              {pageItems(pageIndex, table.getPageCount()).map((item, index) =>
                item === null ? (
                  <span key={`gap-${index}`} className="px-1" aria-hidden>
                    …
                  </span>
                ) : (
                  <PageButton
                    key={item}
                    onClick={() => table.setPageIndex(item)}
                    aria-current={item === pageIndex ? "page" : undefined}
                    aria-label={`Page ${item + 1}`}
                  >
                    {item + 1}
                  </PageButton>
                ),
              )}
              <PageButton onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
                <ChevronRight className="size-4" />
              </PageButton>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

function PageButton(props: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="flex size-8 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground tabular-nums transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40 aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
    />
  );
}

function pageItems(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, index) => index);
  const pages = new Set([0, count - 1, current - 1, current, current + 1].filter((page) => page >= 0 && page < count));
  if (current <= 2) [1, 2, 3].forEach((page) => pages.add(page));
  if (current >= count - 3) [count - 4, count - 3, count - 2].forEach((page) => pages.add(page));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index > 0 && page - sorted[index - 1]! > 1 ? [null, page] : [page]));
}

export function SortHeader<TData>({ column, title, className }: { column: Column<TData>; title: string; className?: string }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {title}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden />
    </button>
  );
}
