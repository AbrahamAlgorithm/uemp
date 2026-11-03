import { REGISTRATION_STATUS_LABELS, SHEET_STATUS_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import type { RegistrationState, SheetStatus, UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const SHEET_TONES: Record<SheetStatus, string> = {
  DRAFT: "text-neutral-500 [&>span]:bg-neutral-400",
  SUBMITTED: "text-orange-600 [&>span]:bg-orange-500",
  APPROVED: "text-emerald-600 [&>span]:bg-emerald-500",
  REJECTED: "text-red-600 [&>span]:bg-red-500",
};

const REGISTRATION_TONES: Record<RegistrationState, string> = {
  NOT_SUBMITTED: "text-neutral-500 [&>span]:bg-neutral-400",
  SUBMITTED: "text-orange-600 [&>span]:bg-orange-500",
  VALIDATED: "text-emerald-600 [&>span]:bg-emerald-500",
  RETURNED: "text-red-600 [&>span]:bg-red-500",
};

const USER_TONES: Record<UserStatus, string> = {
  ACTIVE: "text-emerald-600 [&>span]:bg-emerald-500",
  INACTIVE: "text-neutral-500 [&>span]:bg-neutral-400",
  SUSPENDED: "text-red-600 [&>span]:bg-red-500",
};

function Tone({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span data-slot="status" className={cn("inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap", className)}>
      <span className="size-1.5 rounded-full" aria-hidden />
      {children}
    </span>
  );
}

export function SheetStatusBadge({ status }: { status: SheetStatus }) {
  return <Tone className={SHEET_TONES[status]}>{SHEET_STATUS_LABELS[status]}</Tone>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Tone className={USER_TONES[status]}>{USER_STATUS_LABELS[status]}</Tone>;
}

export function RegistrationStatusBadge({ status }: { status: RegistrationState | null }) {
  const key = status ?? "NOT_SUBMITTED";
  return <Tone className={REGISTRATION_TONES[key]}>{REGISTRATION_STATUS_LABELS[key]}</Tone>;
}
