import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Lecturer" };

export default function Page() {
  return <ComingSoon title="Lecturer portal" />;
}
