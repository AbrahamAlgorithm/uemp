"use client";

import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FilterSelect } from "@/components/filter-select";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAsync } from "@/hooks/use-async";
import { api, errorMessage } from "@/lib/api";
import { LEVELS } from "@/lib/constants";
import { semesterLabel } from "@/lib/format";
import type { ReportKind, ReportQuery, ReportTable } from "@/lib/types";

const REPORTS: { kind: ReportKind; label: string; description: string; filters: ("level" | "program" | "semester" | "department")[] }[] = [
  { kind: "students", label: "Student list", description: "Every student with their level and CGPA.", filters: ["level", "program"] },
  { kind: "registrations", label: "Registrations", description: "How many students registered for each course.", filters: ["semester"] },
  { kind: "performance", label: "Performance", description: "Results of approved sheets, course by course.", filters: ["semester"] },
  { kind: "at-risk", label: "At-risk students", description: "Students whose CGPA is below the probation line.", filters: [] },
  { kind: "departments", label: "Departments compared", description: "Headcount, validation and approval rates by department.", filters: ["semester"] },
];

const isNumeric = (value: unknown) => typeof value === "number";

function Results({ table }: { table: ReportTable }) {
  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>{table.title}</CardTitle>
      </CardHeader>
      {table.rows.length === 0 ? (
        <EmptyState title="Nothing to report" description="No records match these filters." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {table.columns.map((column, index) => (
                <TableHead key={column.key} className={isNumeric(table.rows[0]?.[column.key]) && index > 0 ? "text-right" : undefined}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, index) => (
              <TableRow key={index}>
                {table.columns.map((column, position) => {
                  const value = row[column.key];
                  return (
                    <TableCell
                      key={column.key}
                      className={isNumeric(table.rows[0]?.[column.key]) && position > 0 ? "text-right tabular-nums" : undefined}
                    >
                      {value ?? "—"}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

interface ReportViewerProps {
  // a super admin picks a department; department admins are always scoped to their own
  departments?: { id: number; name: string }[];
  allowDepartmentsReport?: boolean;
}

export function ReportViewer({ departments, allowDepartmentsReport }: ReportViewerProps) {
  const reports = REPORTS.filter((report) => allowDepartmentsReport || report.kind !== "departments");
  const [kind, setKind] = useState<ReportKind>("students");
  const [filters, setFilters] = useState({ level: "all", program: "all", semester: "current", department: "all" });
  const [downloading, setDownloading] = useState(false);

  const report = reports.find((item) => item.kind === kind) ?? reports[0];
  const scoped = departments !== undefined && report.kind !== "departments";
  const query: ReportQuery = {
    level: report.filters.includes("level") && filters.level !== "all" ? Number(filters.level) : undefined,
    program: report.filters.includes("program") && filters.program !== "all" ? Number(filters.program) : undefined,
    semester: report.filters.includes("semester") && filters.semester !== "current" ? Number(filters.semester) : undefined,
    department: scoped && filters.department !== "all" ? Number(filters.department) : undefined,
  };
  const key = JSON.stringify([kind, query]);

  const options = useAsync(() => Promise.all([api.getPrograms(query.department), api.getSemesters()]), String(query.department ?? "own"));
  const result = useAsync(() => api.getReport(kind, query), key);

  const download = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await api.downloadReport(kind, query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const set = (name: keyof typeof filters) => (value: string) => setFilters((current) => ({ ...current, [name]: value }));
  const [programs, semesters] = options.data ?? [[], []];

  return (
    <>
      <PageHeader
        title="Reports"
        description={result.data ? [result.data.department?.name, result.data.semester && semesterLabel(result.data.semester)].filter(Boolean).join(" · ") : report.description}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button onClick={download} disabled={downloading || !result.data}>
              {downloading ? <Spinner /> : <Download />}
              Download CSV
            </Button>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap print:hidden">
        <FilterSelect
          label="Report"
          value={kind}
          onChange={(value) => setKind(value as ReportKind)}
          allLabel={reports[0].label}
          options={reports.slice(1).map((item) => ({ value: item.kind, label: item.label }))}
          allValue="students"
        />
        {scoped && (
          <FilterSelect
            label="Department"
            value={filters.department}
            onChange={set("department")}
            allLabel="All departments"
            options={departments.map((item) => ({ value: item.id, label: item.name }))}
          />
        )}
        {report.filters.includes("level") && (
          <FilterSelect
            label="Level"
            value={filters.level}
            onChange={set("level")}
            allLabel="All levels"
            options={LEVELS.map((value) => ({ value, label: `${value} level` }))}
          />
        )}
        {report.filters.includes("program") && (
          <FilterSelect
            label="Program"
            value={filters.program}
            onChange={set("program")}
            allLabel="All programs"
            options={programs.map((item) => ({ value: item.id, label: item.name }))}
          />
        )}
        {report.filters.includes("semester") && (
          <FilterSelect
            label="Semester"
            value={filters.semester}
            onChange={set("semester")}
            allLabel="Current semester"
            allValue="current"
            options={semesters.map((item) => ({ value: item.id, label: semesterLabel(item) }))}
          />
        )}
      </div>

      {result.error ? (
        <ErrorState error={result.error} onRetry={result.reload} />
      ) : !result.data ? (
        <PageSkeleton rows={6} />
      ) : (
        <div className="space-y-6">
          {result.data.tables.map((table) => (
            <Results key={table.title} table={table} />
          ))}
        </div>
      )}
    </>
  );
}
