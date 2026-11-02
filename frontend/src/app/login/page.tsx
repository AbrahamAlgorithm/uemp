import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <ComingSoon title="Sign in" />;
}
