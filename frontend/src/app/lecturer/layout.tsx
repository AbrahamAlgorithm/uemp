import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Lecturer" };

export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="LECTURER">{children}</AppShell>;
}
