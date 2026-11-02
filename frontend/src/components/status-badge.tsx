import { Badge } from "@/components/ui/badge";
import { SHEET_STATUS_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import type { SheetStatus, UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHEET_TONES: Record<SheetStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-700 ring-stone-500/20 [&>span]:bg-stone-400",
  SUBMITTED: "bg-sky-50 text-sky-700 ring-sky-600/20 [&>span]:bg-sky-500",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 [&>span]:bg-emerald-500",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20 [&>span]:bg-red-500",
};

const USER_TONES: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 [&>span]:bg-emerald-500",
  INACTIVE: "bg-stone-100 text-stone-700 ring-stone-500/20 [&>span]:bg-stone-400",
  SUSPENDED: "bg-amber-50 text-amber-800 ring-amber-600/25 [&>span]:bg-amber-500",
};

function Tone({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-0 ring-1 ring-inset", className)}>
      <span className="size-1.5 rounded-full" aria-hidden />
      {children}
    </Badge>
  );
}

export function SheetStatusBadge({ status }: { status: SheetStatus }) {
  return <Tone className={SHEET_TONES[status]}>{SHEET_STATUS_LABELS[status]}</Tone>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Tone className={USER_TONES[status]}>{USER_STATUS_LABELS[status]}</Tone>;
}
