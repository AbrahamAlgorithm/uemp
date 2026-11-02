"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, ClipboardList, GraduationCap, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { FloatingField } from "@/components/auth/floating-field";
import { useSession } from "@/components/session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, usingMocks } from "@/lib/api";
import { ROLE_HOME } from "@/lib/constants";
import { loginSchema, type LoginInput } from "@/lib/schemas";

export default function LoginPage() {
  const { user, signIn } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: "", password: "" } });
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
    <AuthLayout
      image={{ src: "/images/graduate.jpg", alt: "A graduate in a cap and gown smiling on campus" }}
      headline="Your registration, results and records in one place."
      points={[
        { icon: ClipboardList, title: "Course registration", description: "Register each semester's courses within your unit limit." },
        { icon: GraduationCap, title: "Reviewed results", description: "Scores are approved by your department before you see them." },
      ]}
      topAction={
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">First time here?</span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/activate">
              Activate<span className="hidden sm:inline"> account</span>
            </Link>
          </Button>
        </p>
      }
      demo={
        usingMocks && (
          <DemoAccounts
            show="password"
            selected={form.watch("identifier")}
            onPick={(account) => {
              setError(null);
              form.reset({ identifier: account.identifier, password: account.password });
            }}
          />
        )
      }
    >
      <AuthHeading icon={LogIn} title="Sign in" description="Use your staff or student ID and your portal password." />
      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FloatingField control={form.control} name="identifier" label="Staff/Student ID" autoComplete="username" autoFocus />
        <FloatingField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
        <div className="flex justify-end">
          <Link href="/reset-password" className="text-sm font-medium underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
