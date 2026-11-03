import { LecturersManager } from "@/components/lecturers-manager";
import { PageHeader } from "@/components/page-header";

export default function DepartmentLecturersPage() {
  return (
    <>
      <PageHeader title="Lecturers" description="Courses and units are for the current semester." />
      <LecturersManager />
    </>
  );
}
