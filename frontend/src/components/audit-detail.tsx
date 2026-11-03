"use client";

import { DetailList } from "@/components/detail-list";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { auditActionLabel, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const show = (value: unknown) => (value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 1));

function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  if (!before && !after) return <p className="text-sm text-muted-foreground">This entry has no recorded values.</p>;

  const changed = (key: string) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]);
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort(
    (a, b) => Number(changed(b)) - Number(changed(a)),
  );

  return (
    <div className="overflow-hidden rounded-lg border text-sm">
      <div className="grid grid-cols-[7rem_1fr_1fr] gap-px bg-border text-xs font-medium text-muted-foreground">
        <div className="bg-muted/60 px-3 py-2">Field</div>
        <div className="bg-muted/60 px-3 py-2">Before</div>
        <div className="bg-muted/60 px-3 py-2">After</div>
        {keys.map((key) => {
          const different = changed(key);
          return (
            <div key={key} className="contents text-foreground">
              <div className="bg-card px-3 py-2 font-medium break-words">{key}</div>
              <div className={cn("bg-card px-3 py-2 break-words whitespace-pre-wrap", different && "bg-red-50 text-red-900")}>
                {show(before?.[key])}
              </div>
              <div className={cn("bg-card px-3 py-2 break-words whitespace-pre-wrap", different && "bg-emerald-50 text-emerald-900")}>
                {show(after?.[key])}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AuditDetail({ id }: { id: number }) {
  const { data, error, reload } = useAsync(() => api.getAuditEntry(id), id);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <DetailList
        className="sm:grid-cols-2"
        items={[
          { label: "Action", value: auditActionLabel(data.action) },
          { label: "Time", value: formatDateTime(data.at) },
          { label: "User", value: data.actor ? `${data.actor.name} (${ROLE_LABELS[data.actor.role]})` : data.actorEmail },
          { label: "Department", value: data.department?.name ?? "University-wide" },
          { label: "Target", value: data.target },
          { label: "Record", value: `${data.entityType} #${data.entityId}` },
          { label: "IP address", value: data.ipAddress },
          { label: "Details", value: data.details },
        ]}
      />
      <div>
        <h3 className="mb-2 text-sm font-semibold">Changes</h3>
        <Diff before={data.before} after={data.after} />
      </div>
    </div>
  );
}
