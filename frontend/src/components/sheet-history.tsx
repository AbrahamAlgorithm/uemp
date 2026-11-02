import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { SheetAction, SheetEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const EVENTS: Record<SheetAction, { label: string; dot: string }> = {
  SUBMITTED: { label: "Submitted for approval", dot: "bg-sky-500" },
  APPROVED: { label: "Approved", dot: "bg-emerald-500" },
  REJECTED: { label: "Returned for corrections", dot: "bg-red-500" },
  REOPENED: { label: "Reopened", dot: "bg-amber-500" },
};

export function SheetHistory({ events }: { events: SheetEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not submitted yet.</p>
        ) : (
          <ol className="space-y-4">
            {[...events].reverse().map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex gap-3 text-sm">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENTS[event.action].dot)} aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">{EVENTS[event.action].label}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.actor.name} · {formatDateTime(event.at)}
                  </p>
                  {event.note && <p className="mt-1.5 rounded-md bg-muted px-3 py-2 text-sm">{event.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
