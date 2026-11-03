"use client";

import { PageHeader } from "@/components/page-header";
import { ErrorState, PageSkeleton } from "@/components/states";
import { StudentLevelsTable } from "@/components/student-levels-table";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function DepartmentStudentsPage() {
  const { data, error, reload } = useAsync(() => api.getStudentLevels());

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={5} />;

  const total = data.reduce((sum, row) => sum + row.studentCount, 0);

  return (
    <>
      <PageHeader title="Students" description={`${total} students in the department. Choose a level to see who is in it.`} />
      <StudentLevelsTable levels={data} hrefFor={(level) => `/department/students/level/${level}`} />
    </>
  );
}
