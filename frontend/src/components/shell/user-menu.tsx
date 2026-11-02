"use client";

import { ChevronDown, LogOut, UserRound } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import type { SessionUser } from "@/lib/types";

import { PROFILE_PATH } from "./navigation";
import { useSignOut } from "./use-sign-out";

export function UserMenu({ user }: { user: SessionUser }) {
  const signOut = useSignOut();
  const profile = PROFILE_PATH[user.role];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-0.5 pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary text-sm font-medium text-primary-foreground">{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left leading-tight xl:block">
          <span className="block text-sm font-medium">{user.fullName}</span>
          <span className="block text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]}
            {user.department && ` · ${user.department.code}`}
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile && (
          <DropdownMenuItem asChild>
            <Link href={profile}>
              <UserRound />
              Profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
