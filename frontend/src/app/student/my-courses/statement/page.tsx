"use client";

import { PrintDetails, PrintSheet } from "@/components/print-sheet";
import { SemesterResultsTable } from "@/components/semester-results-table";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import { formatGpa } from "@/lib/grading";

export default function ResultStatementPage() {
  const { data, error, reload } = useAsync(api.getStatement);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={10} />;

  const { student } = data;

  return (
    <PrintSheet title="Statement of results" backHref="/student/my-courses">
      <PrintDetails
        items={[
          { label: "Name", value: student.fullName },
          { label: "Matric number", value: student.matricNumber },
          { label: "Faculty", value: student.faculty.name },
          { label: "Department", value: student.department.name },
          { label: "Program", value: `${student.program.award} ${student.program.name}` },
          { label: "Level", value: `${student.level} level` },
        ]}
      />
      {data.semesters.length === 0 ? (
        <p className="text-muted-foreground">No approved results yet.</p>
      ) : (
        data.semesters.map((result) => (
          <section key={result.semester.id} className="break-inside-avoid">
            <h2 className="mb-2 font-semibold">{semesterLabel(result.semester)}</h2>
            <SemesterResultsTable result={result} compact />
          </section>
        ))
      )}
      <div className="flex justify-end gap-10 border-t-2 border-foreground/60 pt-3">
        <p>
          Units passed{" "}
          <span className="font-semibold tabular-nums">
            {data.unitsPassed} of {data.unitsAttempted}
          </span>
        </p>
        <p>
          Cumulative GPA <span className="font-semibold tabular-nums">{formatGpa(data.cgpa)}</span>
        </p>
      </div>
      <section className="break-inside-avoid">
        <h2 className="mb-2 font-semibold">Grading scale</h2>
        <p className="tabular-nums">
          {data.bands.map((band) => `${band.grade} ${band.min}–${band.max} (${band.point})`).join("  ·  ")}
        </p>
      </section>
      <p className="text-xs text-muted-foreground">
        This statement lists approved results only and is not an official transcript.
      </p>
    </PrintSheet>
  );
}
