import { CircleCheck, Clock, RotateCcw, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/format";
import type { ResultSheetSummary } from "@/lib/types";

export function SheetBanner({ sheet, audience }: { sheet: ResultSheetSummary; audience: "lecturer" | "reviewer" }) {
  if (sheet.status === "REJECTED") {
    return (
      <Banner tone="red" icon={TriangleAlert} title="Returned for corrections">
        {sheet.feedback}
        <span className="mt-1 block text-xs opacity-80">Reviewed {formatDateTime(sheet.reviewedAt)}</span>
      </Banner>
    );
  }
  if (sheet.status === "SUBMITTED") {
    return (
      <Banner tone="sky" icon={Clock} title="Awaiting departmental approval">
        Submitted {formatDateTime(sheet.submittedAt)}.
        {audience === "lecturer" && " Scores are read-only while the department reviews them."}
      </Banner>
    );
  }
  if (sheet.status === "APPROVED") {
    return (
      <Banner tone="emerald" icon={CircleCheck} title="Approved">
        Approved {formatDateTime(sheet.reviewedAt)}. These results are visible to students.
      </Banner>
    );
  }
  if (sheet.feedback) {
    return (
      <Banner tone="amber" icon={RotateCcw} title="Reopened by the department">
        {sheet.feedback}
      </Banner>
    );
  }
  if (audience === "reviewer") {
    return (
      <Banner tone="stone" icon={Clock} title="Not submitted yet">
        The lecturer is still entering scores for this course.
      </Banner>
    );
  }
  return null;
}

const TONES = {
  red: "border-red-200 bg-red-50 text-red-900 *:data-[slot=alert-description]:text-red-800",
  sky: "border-sky-200 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 *:data-[slot=alert-description]:text-emerald-800",
  amber: "border-amber-200 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800",
  stone: "border-stone-200 bg-stone-50 text-stone-900 *:data-[slot=alert-description]:text-stone-700",
};

function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: typeof Clock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Alert className={TONES[tone]}>
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
