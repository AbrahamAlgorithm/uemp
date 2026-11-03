import { CoursesManager } from "@/components/courses-manager";
import { PageHeader } from "@/components/page-header";

export default function DepartmentCoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="The department's course catalogue, level by level." />
      <CoursesManager />
    </>
  );
}
