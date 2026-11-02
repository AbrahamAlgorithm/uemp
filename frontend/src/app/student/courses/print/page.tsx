"use client";

import { PrintDetails, PrintSheet, SignatureLines } from "@/components/print-sheet";
import { ErrorState, PageSkeleton } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { SEMESTER_LABELS } from "@/lib/constants";

export default function RegistrationSlipPage() {
  const { data, error, reload } = useAsync(api.getMyCourses);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={8} />;

  const { student, semester } = data;

  return (
    <PrintSheet
      title="Course registration slip"
      subtitle={`${semester.session.name} session · ${SEMESTER_LABELS[semester.name]}`}
      backHref="/student/courses"
    >
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
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y bg-muted/60 text-left text-xs tracking-wide uppercase">
            <th className="w-10 px-2 py-2 font-medium">S/N</th>
            <th className="px-2 py-2 font-medium">Code</th>
            <th className="px-2 py-2 font-medium">Title</th>
            <th className="px-2 py-2 text-right font-medium">Units</th>
          </tr>
        </thead>
        <tbody>
          {data.courses.map((course, index) => (
            <tr key={course.id} className="border-b">
              <td className="px-2 py-2 tabular-nums">{index + 1}</td>
              <td className="px-2 py-2 font-medium whitespace-nowrap">{course.code}</td>
              <td className="px-2 py-2">{course.title}</td>
              <td className="px-2 py-2 text-right tabular-nums">{course.units}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-b-2 border-foreground/60">
            <td colSpan={3} className="px-2 py-2 font-semibold">
              Total units
            </td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{data.totalUnits}</td>
          </tr>
        </tfoot>
      </table>
      <SignatureLines labels={["Student", "Level adviser", "Head of department"]} />
    </PrintSheet>
  );
}
