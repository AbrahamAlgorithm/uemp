import { Badge } from "@/components/ui/badge";
import { formatGpa } from "@/lib/grading";
import type { SemesterResult } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SemesterResultsTable({ result, compact }: { result: SemesterResult; compact?: boolean }) {
  const cell = compact ? "px-2 py-1.5" : "px-3 py-2.5 first:pl-6 last:pr-6";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
            <th className={cn(cell, "font-medium")}>Code</th>
            <th className={cn(cell, "font-medium")}>Title</th>
            <th className={cn(cell, "text-right font-medium")}>Units</th>
            <th className={cn(cell, "text-right font-medium")}>CA</th>
            <th className={cn(cell, "text-right font-medium")}>Exam</th>
            <th className={cn(cell, "text-right font-medium")}>Total</th>
            <th className={cn(cell, "text-center font-medium")}>Grade</th>
            <th className={cn(cell, "text-right font-medium")}>Point</th>
          </tr>
        </thead>
        <tbody>
          {result.courses.map((course) => (
            <tr key={course.registrationId} className="border-b">
              <td className={cn(cell, "font-medium whitespace-nowrap")}>
                {course.code}
                {course.isCarryOver &&
                  (compact ? (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(carry-over)</span>
                  ) : (
                    <Badge variant="outline" className="ml-2 border-orange-300 bg-orange-50 text-orange-700">
                      Carry-over
                    </Badge>
                  ))}
              </td>
              <td className={cn(cell, "min-w-48")}>{course.title}</td>
              <td className={cn(cell, "text-right tabular-nums")}>{course.units}</td>
              <td className={cn(cell, "text-right tabular-nums")}>{course.ca ?? "—"}</td>
              <td className={cn(cell, "text-right tabular-nums")}>{course.exam ?? "—"}</td>
              <td className={cn(cell, "text-right font-medium tabular-nums")}>{course.total}</td>
              <td className={cn(cell, "text-center font-semibold", course.grade === "F" && "text-destructive")}>{course.grade}</td>
              <td className={cn(cell, "text-right tabular-nums")}>{course.gradePoint}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-sm">
            <td colSpan={2} className={cn(cell, "font-medium")}>
              Semester GPA <span className="font-semibold">{formatGpa(result.gpa)}</span>
            </td>
            <td className={cn(cell, "text-right font-medium tabular-nums")}>{result.units}</td>
            <td colSpan={5} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
