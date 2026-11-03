"use client";

import { PencilLine } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { EntriesTable } from "@/components/entries-table";
import { PageHeader } from "@/components/page-header";
import { PerformanceSummary } from "@/components/performance-summary";
import { SheetBanner } from "@/components/sheet-banner";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function LecturerCoursePage() {
  const { id } = useParams<{ id: string }>();
  const offeringId = Number(id);
  const { data: sheet, error, reload } = useAsync(() => api.getLecturerSheet(offeringId), offeringId);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!sheet) return <PageSkeleton cards={4} rows={8} />;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/lecturer/courses", label: "My courses" }}
        title={`${sheet.course.code} ${sheet.course.title}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {semesterLabel(sheet.semester)} · {sheet.course.units} units · {sheet.scoredCount} of {sheet.studentCount} scored
            <SheetStatusBadge status={sheet.status} />
          </span>
        }
        actions={
          <Button variant={sheet.editable ? "default" : "outline"} asChild>
            <Link href={`/lecturer/courses/${offeringId}/scores`}>
              <PencilLine />
              {sheet.editable ? "Enter scores" : "View scores"}
            </Link>
          </Button>
        }
      />
      <SheetBanner sheet={sheet} audience="lecturer" />
      <PerformanceSummary summary={sheet.summary} />
      <section>
        <h2 className="mb-3 text-base font-semibold">Class list</h2>
        <EntriesTable entries={sheet.entries} />
      </section>
    </div>
  );
}
