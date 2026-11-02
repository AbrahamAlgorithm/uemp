import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatScore } from "@/lib/format";
import { GRADES, summarise } from "@/lib/grading";
import type { GradeDistribution as Distribution, ResultEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GradeDistribution({ distribution }: { distribution: Distribution }) {
  const total = GRADES.reduce((sum, grade) => sum + distribution[grade], 0);
  return (
    <div className="space-y-2">
      {GRADES.map((grade) => {
        const count = distribution[grade];
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

export function PerformanceSummary({ entries }: { entries: ResultEntry[] }) {
  const summary = summarise(entries);
  const stats = [
    { label: "Scored", value: `${summary.scored} of ${entries.length}` },
    { label: "Average", value: formatScore(summary.average) },
    { label: "Pass rate", value: formatPercent(summary.passRate) },
    { label: "Highest", value: formatScore(summary.highest) },
    { label: "Lowest", value: formatScore(summary.lowest) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="mb-3 text-xs text-muted-foreground">Grade distribution</p>
          {summary.scored ? (
            <GradeDistribution distribution={summary.distribution} />
          ) : (
            <p className="text-sm text-muted-foreground">No complete scores yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
