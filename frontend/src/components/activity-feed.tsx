import {
  CalendarCog,
  CircleCheck,
  CircleX,
  ClipboardList,
  LogIn,
  PencilLine,
  Plus,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { auditActionLabel } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { AuditRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const MUTED = "bg-muted text-foreground";
const GREEN = "bg-emerald-50 text-emerald-600";
const BLUE = "bg-blue-50 text-blue-600";
const ORANGE = "bg-orange-50 text-orange-600";
const RED = "bg-red-50 text-red-600";
const VIOLET = "bg-violet-50 text-violet-600";

const ICONS: Record<string, [LucideIcon, string]> = {
  LOGIN: [LogIn, MUTED],
  LOGOUT: [LogIn, MUTED],
  CREATE: [Plus, GREEN],
  UPDATE: [PencilLine, BLUE],
  DELETE: [Trash2, RED],
  OFFERING_CREATED: [Plus, GREEN],
  LECTURER_ASSIGNED: [UserCog, VIOLET],
  REGISTRATION_SUBMITTED: [ClipboardList, VIOLET],
  REGISTRATION_VALIDATED: [CircleCheck, GREEN],
  REGISTRATION_RETURNED: [CircleX, RED],
  SCORES_SAVED: [PencilLine, BLUE],
  RESULTS_IMPORTED: [PencilLine, BLUE],
  RESULTS_SUBMITTED: [Send, ORANGE],
  RESULTS_APPROVED: [CircleCheck, GREEN],
  RESULTS_REJECTED: [CircleX, RED],
  RESULTS_REOPENED: [RotateCcw, ORANGE],
  PROFILE_UPDATED: [PencilLine, BLUE],
  CHANGE_STATUS: [ShieldCheck, RED],
  CHANGE_ROLE: [ShieldCheck, BLUE],
  SEMESTER_SET_CURRENT: [CalendarCog, MUTED],
  GRADE_SCALE_UPDATED: [Scale, MUTED],
  GRADE_SCALE_RESET: [Scale, MUTED],
};

export function ActivityFeed({ entries }: { entries: AuditRow[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="-mx-(--card-spacing) divide-y border-y">
      {entries.map((entry) => {
        const [Icon, tone] = ICONS[entry.action] ?? [PencilLine, MUTED];
        return (
          <li key={entry.id} className="flex gap-3 px-(--card-spacing) py-3.5 text-sm">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tone)} aria-hidden>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p>
                <span className="font-medium">{entry.actor?.name ?? (entry.actorEmail || "Removed user")}</span>{" "}
                <span className="text-muted-foreground">{auditActionLabel(entry.action).toLowerCase()}</span>
                {entry.target && entry.action !== "LOGIN" && entry.action !== "LOGOUT" && (
                  <span className="font-medium"> {entry.target}</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <time dateTime={entry.at} title={formatDateTime(entry.at)}>
                  {timeAgo(entry.at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
