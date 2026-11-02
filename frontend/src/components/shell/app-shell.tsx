"use client";

import { CalendarDays, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { semesterLabel } from "@/lib/format";
import type { Role } from "@/lib/types";

import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user, status } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = user?.role === role;

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (user && user.role !== role) router.replace("/forbidden");
  }, [status, user, role, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:pl-64 print:pl-0!">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex print:hidden">
        <div className="flex h-16 items-center border-b px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav role={role} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card px-4 sm:px-6 lg:px-8 print:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetHeader className="h-16 justify-center border-b px-5">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
              </SheetHeader>
              <div className="overflow-y-auto px-3 py-5">
                <SidebarNav role={role} onNavigate={() => setMenuOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <CurrentSemester />
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function CurrentSemester() {
  const { data } = useAsync(api.getCurrentSemester);
  if (!data) return null;
  return (
    <p className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
      <CalendarDays className="size-4 text-primary" aria-hidden />
      {semesterLabel(data)}
    </p>
  );
}
