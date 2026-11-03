"use client";

import { AllocationsView } from "@/components/allocations-view";
import { PageHeader } from "@/components/page-header";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function DepartmentAllocationsPage() {
  const { data: semester } = useAsync(api.getCurrentSemester);

  return (
    <>
      <PageHeader
        title="Allocations"
        description={`Who teaches what${semester ? ` in ${semesterLabel(semester)}` : ""}.`}
      />
      <AllocationsView />
    </>
  );
}
