"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/form-fields";
import { useSession } from "@/components/session-provider";
import { Brand } from "@/components/shell/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAsync } from "@/hooks/use-async";
import { api, errorMessage, usingMocks } from "@/lib/api";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/constants";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import type { DemoAccount } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { user, signIn } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { isSubmitting } = form.formState;

  useEffect(() => {
    if (user) router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const signedIn = await signIn(values);
      router.replace(ROLE_HOME[signedIn.role]);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <Brand />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Use your university email address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {usingMocks && (
              <DemoAccounts
                onPick={(account) => {
                  setError(null);
                  form.reset({ email: account.email, password: account.password });
                }}
                selectedEmail={form.watch("email")}
              />
            )}
            <form onSubmit={submit} noValidate>
              <FieldGroup>
                {error && (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <TextField control={form.control} name="email" label="Email" type="email" autoComplete="username" />
                <TextField
                  control={form.control}
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Spinner />}
                  Sign in
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function DemoAccounts({ onPick, selectedEmail }: { onPick: (account: DemoAccount) => void; selectedEmail: string }) {
  const { data: accounts } = useAsync(api.getDemoAccounts);
  if (!accounts?.length) return null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed bg-muted/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">Demo data · sign in as</p>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Demo accounts">
        {accounts.map((account) => (
          <Button
            key={account.role}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={selectedEmail === account.email}
            onClick={() => onPick(account)}
            className={cn(selectedEmail === account.email && "border-primary bg-accent text-accent-foreground")}
          >
            {ROLE_LABELS[account.role]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {accounts.find((account) => account.email === selectedEmail)?.name ?? `Password for every account: ${accounts[0]!.password}`}
      </p>
    </div>
  );
}
