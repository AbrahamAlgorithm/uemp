"use client";

import { CircleCheck, Clock, PencilLine, TriangleAlert } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ResultSheetsBrowser } from "@/components/result-sheets-browser";
import { StatCard, StatGrid } from "@/components/stat-card";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function AdminResultsPage() {
  const { data, error, reload } = useAsync(api.getResultSheets);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={4} rows={10} />;

  const current = data.filter((sheet) => sheet.semester.isCurrent);
  const count = (status: string) => current.filter((sheet) => sheet.status === status).length;

  return (
    <>
      <PageHeader
        title="Result approval oversight"
        description="Departments approve their own results. This view tracks progress across the university."
      />
      <StatGrid>
        <StatCard label="Awaiting approval" tone="orange" value={count("SUBMITTED")} icon={Clock} hint="This semester" />
        <StatCard label="Approved" tone="green" value={count("APPROVED")} icon={CircleCheck} hint="This semester" />
        <StatCard label="Returned to lecturers" tone="red" value={count("REJECTED")} icon={TriangleAlert} hint="This semester" />
        <StatCard label="Still in draft" tone="neutral" value={count("DRAFT")} icon={PencilLine} hint="This semester" />
      </StatGrid>
      <div className="mt-6">
        <ResultSheetsBrowser sheets={data} showDepartment />
      </div>
    </>
  );
}
