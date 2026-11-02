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
  UserCog,
  type LucideIcon,
} from "lucide-react";

import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/lib/format";
import type { AuditAction, AuditEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<AuditAction, [LucideIcon, string]> = {
  LOGIN: [LogIn, "bg-muted text-foreground"],
  CREATE: [Plus, "bg-emerald-50 text-emerald-600"],
  UPDATE: [PencilLine, "bg-blue-50 text-blue-600"],
  REGISTER_COURSES: [ClipboardList, "bg-violet-50 text-violet-600"],
  SAVE_SCORES: [PencilLine, "bg-blue-50 text-blue-600"],
  SUBMIT_RESULTS: [Send, "bg-orange-50 text-orange-600"],
  APPROVE_RESULTS: [CircleCheck, "bg-emerald-50 text-emerald-600"],
  REJECT_RESULTS: [CircleX, "bg-red-50 text-red-600"],
  REOPEN_RESULTS: [RotateCcw, "bg-orange-50 text-orange-600"],
  ASSIGN_LECTURER: [UserCog, "bg-violet-50 text-violet-600"],
  CHANGE_STATUS: [ShieldCheck, "bg-red-50 text-red-600"],
  CHANGE_ROLE: [ShieldCheck, "bg-blue-50 text-blue-600"],
  SET_CURRENT_SEMESTER: [CalendarCog, "bg-muted text-foreground"],
  UPDATE_GRADE_SCALE: [Scale, "bg-muted text-foreground"],
};

export function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="-mx-(--card-spacing) divide-y border-y">
      {entries.map((entry) => {
        const [Icon, tone] = ICONS[entry.action];
        return (
          <li key={entry.id} className="flex gap-3 px-(--card-spacing) py-3.5 text-sm">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tone)} aria-hidden>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p>
                <span className="font-medium">{entry.actor.name}</span>{" "}
                <span className="text-muted-foreground">{AUDIT_ACTION_LABELS[entry.action].toLowerCase()}</span>
                {entry.action !== "LOGIN" && <span className="font-medium"> {entry.target}</span>}
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
