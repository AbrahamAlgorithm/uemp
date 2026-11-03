import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GradeScale } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GradeScaleLegend({ scale }: { scale: GradeScale }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grading scale</CardTitle>
        <CardDescription>
          {scale.isDefault ? "The national 5-point scale. " : ""}A result keeps the grade it was given when it was submitted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {scale.bands.map((band) => (
            <div key={band.grade} className="rounded-lg border px-3 py-2 text-center">
              <dt className={cn("text-lg font-semibold", band.point === 0 && "text-destructive")}>{band.grade}</dt>
              <dd className="text-xs text-muted-foreground tabular-nums">
                {band.min}–{band.max}
              </dd>
              <dd className="text-xs tabular-nums">
                {band.point} {band.point === 1 ? "point" : "points"}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
