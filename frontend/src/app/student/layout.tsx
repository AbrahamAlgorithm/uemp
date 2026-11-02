import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Student" };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="STUDENT">{children}</AppShell>;
}
