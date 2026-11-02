"use client";

import { AllocationsManager } from "@/components/allocations-manager";
import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function DepartmentAllocationsPage() {
  const { data, error, reload } = useAsync(() =>
    Promise.all([api.getAllocations(), api.getLecturers(), api.getCurrentSemester()]),
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const [allocations, lecturers, semester] = data;

  return (
    <>
      <PageHeader
        title="Allocations"
        description={`Assign a lecturer to each course offered in ${semesterLabel(semester)}.`}
      />
      <AllocationsManager allocations={allocations} lecturers={lecturers} onChanged={reload} />
    </>
  );
}
