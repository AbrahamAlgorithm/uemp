import type { Metadata } from "next";

import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Administration" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="SUPER_ADMIN">{children}</AppShell>;
}
