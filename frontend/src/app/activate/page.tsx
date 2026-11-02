import type { Metadata } from "next";

import { AccountSetup } from "@/components/auth/account-setup";

export const metadata: Metadata = { title: "Activate account" };

export default function ActivatePage() {
  return <AccountSetup mode="activate" />;
}
