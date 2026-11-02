"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EntriesTable } from "@/components/entries-table";
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

export default function ReviewResultSheetPage() {
  const { id } = useParams<{ id: string }>();
  const sheetId = Number(id);
  const { data: sheet, error, reload } = useAsync(() => api.getResultSheet(sheetId), sheetId);
  const [action, setAction] = useState<Action | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!sheet) return <PageSkeleton cards={0} rows={10} />;

  const run = async (reason: string) => {
    const code = sheet.course.code;
    const request =
      action === "approve"
        ? withToast(api.approveSheet(sheet.id), `${code} approved and published to students`)
        : action === "reject"
          ? withToast(api.rejectSheet(sheet.id, reason), `${code} returned to ${sheet.lecturer.name}`)
          : withToast(api.reopenSheet(sheet.id, reason), `${code} reopened for corrections`);
    const done = await request;
    if (done) reload();
    return done;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/department/results", label: "Result sheets" }}
        title={`${sheet.course.code} ${sheet.course.title}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {sheet.lecturer.name} · {semesterLabel(sheet.semester)} · {sheet.studentCount} students
            <SheetStatusBadge status={sheet.status} />
          </span>
        }
        actions={
          <>
            {sheet.status === "SUBMITTED" && (
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <PerformanceSummary entries={sheet.entries} />
          <section>
            <h2 className="mb-3 text-base font-semibold">Scores</h2>
            <EntriesTable entries={sheet.entries} />
          </section>
        </div>
        <div>
          <SheetHistory events={sheet.history} />
        </div>
      </div>

      <ConfirmDialog
        open={action === "approve"}
        onOpenChange={(open) => !open && setAction(null)}
        title={`Approve ${sheet.course.code}?`}
        description="Students will see these results and they'll count towards GPA and CGPA."
        confirmLabel="Approve"
        onConfirm={run}
      />
      <ConfirmDialog
        open={action === "reject"}
        onOpenChange={(open) => !open && setAction(null)}
        title={`Reject ${sheet.course.code}?`}
        description="The sheet goes back to the lecturer for corrections along with your feedback."
        confirmLabel="Reject"
        destructive
        reason={{ label: "Feedback for the lecturer", placeholder: "What needs to change before you can approve it" }}
        onConfirm={run}
      />
      <ConfirmDialog
        open={action === "reopen"}
        onOpenChange={(open) => !open && setAction(null)}
        title={`Reopen ${sheet.course.code}?`}
        description="Students lose access to these results until the lecturer resubmits and you approve them again."
        confirmLabel="Reopen"
        destructive
        reason={{ label: "Reason for reopening", placeholder: "e.g. A script was remarked after a student complaint" }}
        onConfirm={run}
      />
    </div>
  );
}
