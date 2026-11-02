import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "attention";
}

export function StatCard({ label, value, icon: Icon, hint, href, tone = "default" }: StatCardProps) {
  const card = (
    <Card size="sm" className={cn("h-full", href && "transition-shadow hover:ring-primary/30")}>
      <CardContent className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            tone === "attention" ? "bg-amber-50 text-amber-700" : "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {card}
    </Link>
  ) : (
    card
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
