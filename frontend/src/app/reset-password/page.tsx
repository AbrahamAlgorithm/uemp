import type { Metadata } from "next";

import { AccountSetup } from "@/components/auth/account-setup";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return <AccountSetup mode="reset" />;
}
