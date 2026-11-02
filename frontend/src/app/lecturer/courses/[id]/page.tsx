"use client";

import { PencilLine } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { EntriesTable } from "@/components/entries-table";
import { PageHeader } from "@/components/page-header";
import { PerformanceSummary } from "@/components/performance-summary";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function LecturerCoursePage() {
  const { id } = useParams<{ id: string }>();
  const allocationId = Number(id);
  const { data, error, reload } = useAsync(() => api.getLecturerCourse(allocationId), allocationId);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton cards={0} rows={8} />;

  const { course, sheet } = data;
  const editable = sheet.status === "DRAFT" || sheet.status === "REJECTED";

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/lecturer/courses", label: "My courses" }}
        title={`${course.course.code} ${course.course.title}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {semesterLabel(course.semester)} · {course.course.units} units · {course.studentCount} students
            <SheetStatusBadge status={sheet.status} />
          </span>
        }
        actions={
          <Button variant={editable ? "default" : "outline"} asChild>
            <Link href={`/lecturer/courses/${allocationId}/scores`}>
              <PencilLine />
              {editable ? "Enter scores" : "View scores"}
            </Link>
          </Button>
        }
      />
      <PerformanceSummary entries={sheet.entries} />
      <section>
        <h2 className="mb-3 text-base font-semibold">Class list</h2>
        <EntriesTable entries={sheet.entries} />
      </section>
    </div>
  );
}
