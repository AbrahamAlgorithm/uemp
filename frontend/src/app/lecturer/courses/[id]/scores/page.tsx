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
  const offeringId = Number(id);
  const { data, error, reload, setData } = useAsync(
    () => Promise.all([api.getLecturerSheet(offeringId), api.getGradeScale()]),
    offeringId,
  );

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const [sheet, scale] = data;

  return (
    <>
      <PageHeader
        back={{ href: `/lecturer/courses/${offeringId}`, label: sheet.course.code }}
        title={`Scores · ${sheet.course.code}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {sheet.course.title} · {semesterLabel(sheet.semester)}
            <SheetStatusBadge status={sheet.status} />
          </span>
        }
      />
      {sheet.entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No students on the class list"
            description="Students appear here once their department validates their course registration."
          />
        </Card>
      ) : (
        <ScoreEntry
          key={`${sheet.id}-${sheet.status}`}
          sheet={sheet}
          scale={scale}
          onSaved={(next) => setData([next, scale])}
          onSubmitted={reload}
        />
      )}
    </>
  );
}
