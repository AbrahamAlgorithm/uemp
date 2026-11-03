"use client";

import { ReportViewer } from "@/components/report-viewer";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function AdminReportsPage() {
  const { data, error, reload } = useAsync(() => api.getDepartments());

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  return <ReportViewer departments={data} allowDepartmentsReport />;
}
