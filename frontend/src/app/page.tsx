"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/components/session-provider";
import { Spinner } from "@/components/ui/spinner";
import { ROLE_HOME } from "@/lib/constants";

export default function HomePage() {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (user) router.replace(ROLE_HOME[user.role]);
  }, [status, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <Spinner className="size-6 text-primary" />
    </div>
  );
}
