"use client";

import { CoursesManager } from "@/components/courses-manager";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function AdminCoursesPage() {
  const { data, error, reload } = useAsync(() =>
    Promise.all([api.getCourses(), api.getPrograms(), api.getDepartments()]),
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const [courses, programs, departments] = data;

  return <CoursesManager courses={courses} programs={programs} departments={departments} onChanged={reload} />;
}
