import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-muted text-foreground",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
};

export type StatTone = keyof typeof TONES;

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  href?: string;
  tone?: StatTone;
}

export function StatCard({ label, value, icon: Icon, hint, href, tone = "neutral" }: StatCardProps) {
  const card = (
    <Card className={cn("h-full gap-0 px-5 py-5", href && "transition-shadow hover:shadow-md")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", TONES[tone])}>
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="truncate text-[15px] text-muted-foreground">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );

  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {card}
    </Link>
  ) : (
    card
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
