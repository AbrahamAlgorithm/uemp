import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Department" };

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="DEPT_ADMIN">{children}</AppShell>;
}
