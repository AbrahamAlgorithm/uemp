"use client";

import { useParams } from "next/navigation";

import { StudentLevelList } from "@/components/student-level-list";
import type { Level } from "@/lib/types";

export default function DepartmentLevelPage() {
  const level = Number(useParams<{ level: string }>().level) as Level;

  return (
    <StudentLevelList
      level={level}
      breadcrumbs={[{ label: "Students", href: "/department/students" }, { label: `${level} level` }]}
      hrefFor={(student) => `/department/students/${student.id}`}
    />
  );
}
