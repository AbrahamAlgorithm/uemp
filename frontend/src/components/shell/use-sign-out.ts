"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useSession } from "@/components/session-provider";
import { errorMessage } from "@/lib/api";

export function useSignOut() {
  const { signOut } = useSession();
  const router = useRouter();

  return async () => {
    try {
      await signOut();
      router.replace("/login");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
}
