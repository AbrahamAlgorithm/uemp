"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CoursesManager } from "@/components/courses-manager";
import { DepartmentAdmins } from "@/components/department-admins";
import { LecturersManager } from "@/components/lecturers-manager";
import { PageHeader } from "@/components/page-header";
import { ProgramsManager } from "@/components/programs-manager";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { StudentLevelsTable } from "@/components/student-levels-table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";

const TABS = [
  { value: "programs", label: "Programs" },
  { value: "courses", label: "Courses" },
  { value: "students", label: "Students" },
  { value: "lecturers", label: "Lecturers" },
  { value: "administrators", label: "Administrators" },
];

function StudentsTab({ facultyId, departmentId }: { facultyId: number; departmentId: number }) {
  const { data, error, reload } = useAsync(() => api.getStudentLevels(departmentId), departmentId);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={4} />;
  return <StudentLevelsTable levels={data} hrefFor={(level) => `/admin/structure/${facultyId}/${departmentId}/students/${level}`} />;
}

function DepartmentTabs() {
  const { facultyId, departmentId } = useParams<{ facultyId: string; departmentId: string }>();
  const faculty = Number(facultyId);
  const department = Number(departmentId);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const tab = TABS.some((item) => item.value === search.get("tab")) ? search.get("tab")! : "programs";

  const { data, error, reload } = useAsync(() => api.getDepartments(faculty), faculty);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <PageSkeleton rows={6} />;

  const current = data.find((item) => item.id === department);
  if (!current) {
    return (
      <Card>
        <EmptyState title="Department not found" description="It may have been deleted or moved to another faculty." />
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Academic structure", href: "/admin/structure" },
          { label: current.faculty.name, href: `/admin/structure/${faculty}` },
          { label: current.name },
        ]}
        title={current.name}
        description={`${current.code} · ${current.studentCount} students · ${current.lecturerCount} lecturers`}
      />
      <Tabs value={tab} onValueChange={(value) => router.replace(`${pathname}?tab=${value}`, { scroll: false })}>
        <TabsList variant="line" className="mb-4 max-w-full overflow-x-auto">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="programs">
          <ProgramsManager departmentId={department} />
        </TabsContent>
        <TabsContent value="courses">
          <CoursesManager departmentId={department} />
        </TabsContent>
        <TabsContent value="students">
          <StudentsTab facultyId={faculty} departmentId={department} />
        </TabsContent>
        <TabsContent value="lecturers">
          <LecturersManager departmentId={department} />
        </TabsContent>
        <TabsContent value="administrators">
          <DepartmentAdmins departmentId={department} />
        </TabsContent>
      </Tabs>
    </>
  );
}

export default function DepartmentPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <DepartmentTabs />
    </Suspense>
  );
}
