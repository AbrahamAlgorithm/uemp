"use client";

import { useParams } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { ScoreEntry } from "@/components/score-entry";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function ScoreEntryPage() {
  const { id } = useParams<{ id: string }>();
  const allocationId = Number(id);
  const { data, error, reload } = useAsync(
    () => Promise.all([api.getLecturerCourse(allocationId), api.getGradeScale()]),
    allocationId,
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const [{ course, sheet }, scale] = data;

  return (
    <>
      <PageHeader
        back={{ href: `/lecturer/courses/${allocationId}`, label: course.course.code }}
        title={`Scores · ${course.course.code}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {course.course.title} · {semesterLabel(course.semester)}
            <SheetStatusBadge status={sheet.status} />
          </span>
        }
      />
      {sheet.entries.length === 0 ? (
        <Card>
          <EmptyState title="No registered students" description="Scores can be entered once students register for this course." />
        </Card>
      ) : (
        <ScoreEntry key={`${sheet.id}-${sheet.status}`} sheet={sheet} scale={scale} onSubmitted={reload} />
      )}
    </>
  );
}
