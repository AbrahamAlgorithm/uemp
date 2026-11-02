import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Department" };

export default function Page() {
  return <ComingSoon title="Department portal" />;
}
