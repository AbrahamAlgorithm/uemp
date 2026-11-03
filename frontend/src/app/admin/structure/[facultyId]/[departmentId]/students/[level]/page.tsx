"use client";

import { useParams } from "next/navigation";

import { StudentLevelList } from "@/components/student-level-list";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import type { Level } from "@/lib/types";

export default function AdminLevelPage() {
  const params = useParams<{ facultyId: string; departmentId: string; level: string }>();
  const faculty = Number(params.facultyId);
  const department = Number(params.departmentId);
  const level = Number(params.level) as Level;
  const { data } = useAsync(() => api.getDepartments(faculty), faculty);
  const current = data?.find((item) => item.id === department);
  const base = `/admin/structure/${faculty}/${department}`;

  return (
    <StudentLevelList
      level={level}
      departmentId={department}
      breadcrumbs={[
        { label: "Academic structure", href: "/admin/structure" },
        { label: current?.faculty.name ?? "Faculty", href: `/admin/structure/${faculty}` },
        { label: current?.name ?? "Department", href: `${base}?tab=students` },
        { label: `${level} level` },
      ]}
      hrefFor={(student) => `${base}/students/${level}/${student.id}`}
    />
  );
}
