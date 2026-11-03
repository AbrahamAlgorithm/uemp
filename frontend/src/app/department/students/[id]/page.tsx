"use client";

import { useParams } from "next/navigation";

import { StudentRecord } from "@/components/student-record";

export default function DepartmentStudentPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <StudentRecord
      studentId={Number(id)}
      crumbs={(student) => [
        { label: "Students", href: "/department/students" },
        { label: `${student.level} level`, href: `/department/students/level/${student.level}` },
      ]}
    />
  );
}
