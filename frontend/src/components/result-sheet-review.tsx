"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntriesTable } from "@/components/entries-table";
import type { Crumb } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { PerformanceSummary } from "@/components/performance-summary";
import { SheetBanner } from "@/components/sheet-banner";
import { SheetHistory } from "@/components/sheet-history";
import { ErrorState, PageSkeleton } from "@/components/states";
import { SheetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import { withToast } from "@/lib/toast";

type Action = "approve" | "reject" | "reopen";

interface ResultSheetReviewProps {
  sheetId: number;
  crumbs: Crumb[];
  canApprove: boolean;
}

export function ResultSheetReview({ sheetId, crumbs, canApprove }: ResultSheetReviewProps) {
  const { data: sheet, error, reload, setData } = useAsync(() => api.getResultSheet(sheetId), sheetId);
  const [action, setAction] = useState<Action | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!sheet) return <PageSkeleton cards={4} rows={10} />;

  const close = (open: boolean) => !open && setAction(null);
  const run = (request: Promise<typeof sheet>, success: string) =>
    withToast(request.then(setData), success);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[...crumbs, { label: `${sheet.course.code}` }]}
        title={`${sheet.course.code} ${sheet.course.title}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {sheet.lecturer?.name ?? "No lecturer"} · {sheet.department.code} · {semesterLabel(sheet.semester)} ·{" "}
            {sheet.studentCount} students
            <SheetStatusBadge status={sheet.status} />
          </span>
        }
        actions={
          <>
            {canApprove && sheet.status === "SUBMITTED" && (
              <>
                <Button variant="outline" onClick={() => setAction("reject")}>
                  <X />
                  Reject
                </Button>
                <Button onClick={() => setAction("approve")}>
                  <Check />
                  Approve
                </Button>
              </>
            )}
            {sheet.status === "APPROVED" && (
              <Button variant="outline" onClick={() => setAction("reopen")}>
                <RotateCcw />
                Reopen
              </Button>
            )}
          </>
        }
      />

      <SheetBanner sheet={sheet} audience="reviewer" />
      <PerformanceSummary summary={sheet.summary} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0">
          <h2 className="mb-3 text-base font-semibold">Scores</h2>
          <EntriesTable entries={sheet.entries} />
        </section>
        <div>
          <SheetHistory events={sheet.timeline} />
        </div>
      </div>

      <ConfirmDialog
        open={action === "approve"}
        onOpenChange={close}
        title={`Approve ${sheet.course.code}?`}
        description="Students will see these results and they'll count towards GPA and CGPA."
        confirmLabel="Approve"
        onConfirm={() => run(api.approveSheet(sheet.id), `${sheet.course.code} approved and published to students`)}
      />
      <ConfirmDialog
        open={action === "reject"}
        onOpenChange={close}
        title={`Reject ${sheet.course.code}?`}
        description="The sheet goes back to the lecturer with your feedback so they can correct it and submit again."
        confirmLabel="Reject"
        destructive
        reason={{ label: "Feedback for the lecturer", placeholder: "What needs to change before you can approve it" }}
        onConfirm={(feedback) =>
          run(api.rejectSheet(sheet.id, feedback), `${sheet.course.code} returned to ${sheet.lecturer?.name ?? "the lecturer"}`)
        }
      />
      <ConfirmDialog
        open={action === "reopen"}
        onOpenChange={close}
        title={`Reopen ${sheet.course.code}?`}
        description="Students lose access to these results until the lecturer resubmits and the department approves them again."
        confirmLabel="Reopen"
        destructive
        reason={{ label: "Reason for reopening", placeholder: "e.g. A script was remarked after a student appeal" }}
        onConfirm={(reason) => run(api.reopenSheet(sheet.id, reason), `${sheet.course.code} reopened for corrections`)}
      />
    </div>
  );
}
