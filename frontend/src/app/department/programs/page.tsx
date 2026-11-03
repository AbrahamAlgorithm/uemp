import { PageHeader } from "@/components/page-header";
import { ProgramsManager } from "@/components/programs-manager";

export default function DepartmentProgramsPage() {
  return (
    <>
      <PageHeader title="Programs" description="Each program runs from 100 level to its final year." />
      <ProgramsManager />
    </>
  );
}
