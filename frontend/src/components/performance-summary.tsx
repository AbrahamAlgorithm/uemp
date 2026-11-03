import { Percent, Sigma, TrendingDown, TrendingUp } from "lucide-react";

import { StatCard, StatGrid } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatScore } from "@/lib/format";
import { GRADES } from "@/lib/grading";
import type { GradeDistribution as Distribution, SheetStats } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GradeDistribution({ distribution }: { distribution: Distribution }) {
  const total = GRADES.reduce((sum, grade) => sum + (distribution[grade] ?? 0), 0);
  return (
    <div className="space-y-2">
      {GRADES.map((grade) => {
        const count = distribution[grade] ?? 0;
        const share = total ? (count / total) * 100 : 0;
        return (
          <div key={grade} className="grid grid-cols-[1.5rem_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="font-medium">{grade}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
              <div
                className={cn("h-full rounded-full", grade === "F" ? "bg-red-400" : "bg-primary/80")}
                style={{ width: `${share}%` }}
              />
            </div>
            <span className="text-right text-muted-foreground tabular-nums">
              {count} · {share.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PerformanceSummary({ summary }: { summary: SheetStats }) {
  const counted = GRADES.reduce((sum, grade) => sum + (summary.distribution[grade] ?? 0), 0);
  const basis =
    counted < summary.students ? `${counted} of ${summary.students} students have scores` : `All ${summary.students} students`;

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard label="Average total" tone="blue" value={formatScore(summary.average)} icon={Sigma} hint={basis} />
        <StatCard label="Highest" tone="green" value={formatScore(summary.highest)} icon={TrendingUp} />
        <StatCard label="Lowest" tone="orange" value={formatScore(summary.lowest)} icon={TrendingDown} />
        <StatCard label="Pass rate" tone="violet" value={formatPercent(summary.passRate)} icon={Percent} hint="Any grade above F" />
      </StatGrid>
      <Card>
        <CardHeader>
          <CardTitle>Grade distribution</CardTitle>
          <CardDescription>
            {summary.scored} of {summary.students} fully scored
            {summary.incomplete > 0 && " · a missing CA or exam counts as 0"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {counted ? (
            <GradeDistribution distribution={summary.distribution} />
          ) : (
            <p className="text-sm text-muted-foreground">No scores entered yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
