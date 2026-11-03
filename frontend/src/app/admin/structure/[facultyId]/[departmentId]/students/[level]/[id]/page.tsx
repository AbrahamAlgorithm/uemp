"use client";

import { useParams } from "next/navigation";

import { StudentRecord } from "@/components/student-record";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

export default function AdminStudentPage() {
  const params = useParams<{ facultyId: string; departmentId: string; level: string; id: string }>();
  const faculty = Number(params.facultyId);
  const department = Number(params.departmentId);
  const { data } = useAsync(() => api.getDepartments(faculty), faculty);
  const current = data?.find((item) => item.id === department);
  const base = `/admin/structure/${faculty}/${department}`;

  return (
    <StudentRecord
      studentId={Number(params.id)}
      crumbs={() => [
        { label: "Academic structure", href: "/admin/structure" },
        { label: current?.faculty.name ?? "Faculty", href: `/admin/structure/${faculty}` },
        { label: current?.name ?? "Department", href: `${base}?tab=students` },
        { label: `${params.level} level`, href: `${base}/students/${params.level}` },
      ]}
    />
  );
}
