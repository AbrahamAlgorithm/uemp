import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatGpa } from "@/lib/grading";
import type { SemesterRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const score = (value: number | null) => (value === null ? "—" : value);

export function SemesterGradesTable({ semester }: { semester: SemesterRecord }) {
  const pending = semester.courses.some((course) => course.grade === null);
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Code</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-right">CA</TableHead>
            <TableHead className="text-right">Exam</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {semester.courses.map((course) => (
            <TableRow key={course.offeringId}>
              <TableCell className="font-medium whitespace-nowrap">
                <span className="flex items-center gap-2">
                  {course.code}
                  {course.isCarryOver && (
                    <Badge variant="outline" className="border-orange-300 bg-orange-50 text-orange-700">
                      Carry-over
                    </Badge>
                  )}
                </span>
              </TableCell>
              <TableCell className="min-w-56">{course.title}</TableCell>
              <TableCell className="text-right tabular-nums">{course.units}</TableCell>
              <TableCell className="text-right tabular-nums">{score(course.ca)}</TableCell>
              <TableCell className="text-right tabular-nums">{score(course.exam)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{score(course.total)}</TableCell>
              <TableCell className={cn("text-center font-semibold", course.grade === "F" && "text-destructive")}>
                {course.grade ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Semester GPA <span className="font-semibold">{formatGpa(semester.gpa)}</span>
            </TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{semester.totalUnits}</TableCell>
            <TableCell colSpan={4} />
          </TableRow>
        </TableFooter>
      </Table>
      {pending && (
        <p className="border-t px-6 py-3 text-xs text-muted-foreground">
          Grades appear once your department approves the course results.
        </p>
      )}
    </>
  );
}
