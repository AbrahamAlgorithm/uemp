"use client";

import { ClipboardList, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Timeline } from "@/components/sheet-history";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";

export default function SubmissionsPage() {
  const { data, error, reload } = useAsync(api.getMySubmissions);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  return (
    <>
      <PageHeader title="Submissions" description="Every result sheet you own, with the department's response and its history." />
      {data.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No result sheets" description="Sheets appear here once you're assigned a course." />
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((sheet) => (
            <Card key={sheet.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {sheet.course.code} <span className="font-normal text-muted-foreground">{sheet.course.title}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {semesterLabel(sheet.semester)} · {sheet.scoredCount} of {sheet.studentCount} scored
                    <SheetStatusBadge status={sheet.status} />
                  </CardDescription>
                </div>
                <Button size="sm" variant={sheet.editable ? "default" : "outline"} asChild>
                  <Link href={`/lecturer/courses/${sheet.offeringId}/scores`}>{sheet.editable ? "Enter scores" : "View scores"}</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {sheet.feedback && (
                  <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <p>
                      <span className="font-medium">
                        {sheet.status === "REJECTED" ? "Department feedback: " : "Reopened: "}
                      </span>
                      {sheet.feedback}
                    </p>
                  </div>
                )}
                <Timeline events={sheet.timeline} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
