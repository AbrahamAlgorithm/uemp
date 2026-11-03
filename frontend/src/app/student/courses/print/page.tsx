"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";

import { PrintDetails, PrintSheet, SignatureLines } from "@/components/print-sheet";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { REGISTRATION_STATUS_LABELS, SEMESTER_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export default function RegistrationSlipPage() {
  const { data: slip, error, reload } = useAsync(api.getRegistrationSlip);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (slip === undefined) return <PageSkeleton rows={8} />;
  if (slip === null) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          title="Nothing to print yet"
          description="Submit your course registration first."
          action={
            <Button asChild>
              <Link href="/student/registration">Go to registration</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const { student, semester } = slip;
  const validated = slip.status === "VALIDATED";

  return (
    <PrintSheet
      title="Course registration slip"
      subtitle={`${semester.session.name} session · ${SEMESTER_LABELS[semester.name]}`}
      backHref="/student/courses"
      stamp={validated ? undefined : "Pending validation"}
    >
      <PrintDetails
        items={[
          { label: "Name", value: student.fullName },
          { label: "Matric number", value: student.matricNumber },
          { label: "Faculty", value: student.faculty.name },
          { label: "Department", value: student.department.name },
          { label: "Program", value: `${student.program.award} ${student.program.name}` },
          { label: "Level", value: `${student.level} level` },
          { label: "Status", value: REGISTRATION_STATUS_LABELS[slip.status] },
          {
            label: validated ? "Validated" : "Submitted",
            value: validated
              ? `${formatDate(slip.validatedAt ?? slip.submittedAt)}${slip.validatedBy ? ` by ${slip.validatedBy.name}` : ""}`
              : formatDate(slip.submittedAt),
          },
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
          {slip.courses.map((course, index) => (
            <tr key={course.offeringId} className="border-b">
              <td className="px-2 py-2 tabular-nums">{index + 1}</td>
              <td className="px-2 py-2 font-medium whitespace-nowrap">
                {course.code}
                {course.isCarryOver && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(carry-over)</span>}
              </td>
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
            <td className="px-2 py-2 text-right font-semibold tabular-nums">{slip.totalUnits}</td>
          </tr>
        </tfoot>
      </table>
      <SignatureLines labels={["Student", "Level adviser", "Head of department"]} />
    </PrintSheet>
  );
}
