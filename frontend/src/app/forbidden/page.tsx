"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ROLE_HOME } from "@/lib/constants";

export default function ForbiddenPage() {
  const { user } = useSession();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-accent text-accent-foreground">
            <ShieldAlert />
          </EmptyMedia>
          <p className="text-sm font-medium text-primary">403</p>
          <EmptyTitle className="text-xl">You don&apos;t have access to this page</EmptyTitle>
          <EmptyDescription>
            It belongs to a different role. If you think this is a mistake, contact the registry.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={user ? ROLE_HOME[user.role] : "/login"}>{user ? "Go to your dashboard" : "Sign in"}</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
