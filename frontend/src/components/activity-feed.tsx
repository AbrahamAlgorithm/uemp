import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

export function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity yet.</p>;

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/50" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">
              {AUDIT_ACTION_LABELS[entry.action]}
              {entry.action !== "LOGIN" && <span className="font-normal text-muted-foreground"> · {entry.target}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.actor.name} · {formatDateTime(entry.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
