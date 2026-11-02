"use client";

import { useAsync } from "@/hooks/use-async";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/constants";
import type { DemoAccount } from "@/lib/types";

interface DemoAccountsProps {
  onPick?: (account: DemoAccount) => void;
  selected?: string;
  show: "password" | "code";
}

export function DemoAccounts({ onPick, selected, show }: DemoAccountsProps) {
  const { data: accounts } = useAsync(api.getDemoAccounts);
  if (!accounts?.length) return null;

  const current = accounts.find((account) => account.identifier === selected);

  return (
    <section aria-label="Demo accounts" className="w-full rounded-2xl border border-dashed bg-muted/60 p-3 sm:max-w-xs">
      <p className="font-medium text-foreground">Demo accounts</p>
      {onPick && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {accounts.map((account) => (
            <button
              key={account.role}
              type="button"
              aria-pressed={account.identifier === selected}
              onClick={() => onPick(account)}
              className="rounded-full border bg-background px-2.5 py-1 text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
            >
              {ROLE_LABELS[account.role]}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2">
        {current && `${current.name} · `}
        {show === "code" ? `Email code ${accounts[0]!.activationCode}` : `Password ${(current ?? accounts[0]!).password}`}
      </p>
    </section>
  );
}
