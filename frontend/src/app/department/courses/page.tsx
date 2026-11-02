"use client";

import { CoursesManager } from "@/components/courses-manager";
import { useSession } from "@/components/session-provider";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function DepartmentCoursesPage() {
  const { user } = useSession();
  const { data, error, reload } = useAsync(() => Promise.all([api.getCourses(), api.getPrograms()]));

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  return (
    <CoursesManager
      courses={data[0]}
      programs={data[1]}
      defaultDepartmentId={user?.department?.id}
      onChanged={reload}
    />
  );
}
