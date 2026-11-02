"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

import { NAVIGATION } from "./navigation";
import { useSignOut } from "./use-sign-out";

const ITEM =
  "flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-[15px] transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none";

export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const home = ROLE_HOME[role];

  const isActive = (href: string) =>
    href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Main" className="space-y-5">
      {NAVIGATION[role].map((group, index) => (
        <div key={group.label ?? index}>
          {group.label && <p className="mb-1.5 px-4 text-xs text-muted-foreground">{group.label}</p>}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      ITEM,
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[0_1px_3px_rgb(0_0_0/0.06)] ring-1 ring-sidebar-border"
                        : "text-sidebar-foreground hover:bg-black/[0.035] hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <button type="button" onClick={signOut} className={cn(ITEM, "text-sidebar-foreground hover:bg-black/[0.035] hover:text-foreground")}>
        <LogOut className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
        Sign out
      </button>
    </nav>
  );
}
