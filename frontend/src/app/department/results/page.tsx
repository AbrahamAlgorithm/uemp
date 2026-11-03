"use client";

import { PageHeader } from "@/components/page-header";
import { ResultSheetsBrowser } from "@/components/result-sheets-browser";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function DepartmentResultsPage() {
  const { data, error, reload } = useAsync(api.getResultSheets);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  return (
    <>
      <PageHeader title="Result sheets" description="Review what lecturers have submitted. Pending sheets are shown first." />
      <ResultSheetsBrowser sheets={data} reviewHref={(sheet) => `/department/results/${sheet.id}`} canApprove />
    </>
  );
}
