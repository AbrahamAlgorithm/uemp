"use client";

import { useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";

type State = "ok" | "error";
type Health = { status: State; database: State };
type Check = State | "checking" | "unknown";

function isHealth(data: unknown): data is Health {
  return typeof data === "object" && data !== null && "database" in data;
}

export function HealthStatus() {
  const [checks, setChecks] = useState<{ api: Check; db: Check }>({
    api: "checking",
    db: "checking",
  });

  useEffect(() => {
    let cancelled = false;

    api<Health>("health/")
      .then((data) => ({ api: "ok" as const, db: data.database }))
      .catch((error: unknown) =>
        // A 503 with a health body means Django answered but the database did not.
        error instanceof ApiError && isHealth(error.data)
          ? { api: "ok" as const, db: error.data.database }
          : { api: "error" as const, db: "unknown" as const },
      )
      .then((next) => {
        if (!cancelled) setChecks(next);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-wrap gap-3" aria-live="polite">
      <Badge label="API" check={checks.api} />
      <Badge label="DB" check={checks.db} />
    </div>
  );
}

const tone: Record<Check, string> = {
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
  checking: "bg-slate-100 text-slate-600 ring-slate-500/20",
  unknown: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

const dot: Record<Check, string> = {
  ok: "bg-emerald-500",
  error: "bg-red-500",
  checking: "bg-slate-400 animate-pulse",
  unknown: "bg-slate-400",
};

function Badge({ label, check }: { label: string; check: Check }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${tone[check]}`}
    >
      <span className={`size-2 rounded-full ${dot[check]}`} aria-hidden />
      {label}: {check}
    </span>
  );
}
