"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, KeyRound, Mail, MailCheck, MailOpen, ShieldCheck, Timer, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { CodeInput } from "@/components/auth/code-input";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { FloatingField } from "@/components/auth/floating-field";
import { useSession } from "@/components/session-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, errorMessage, usingMocks } from "@/lib/api";
import { ROLE_HOME } from "@/lib/constants";
import {
  activationRequestSchema,
  newPasswordSchema,
  type ActivationRequestInput,
  type NewPasswordInput,
} from "@/lib/schemas";

const COPY = {
  activate: {
    icon: UserRoundCheck,
    title: "Activate your account",
    description: "First time on the portal? Confirm who you are and we'll email you a code to set your password.",
    passwordTitle: "Choose a password",
    done: "Your account is ready",
  },
  reset: {
    icon: KeyRound,
    title: "Reset your password",
    description: "Enter your ID and the email on your record. We'll send you a code to set a new password.",
    passwordTitle: "Set a new password",
    done: "Password updated",
  },
};

interface Challenge {
  maskedEmail: string;
  expiresAt: number;
  resendAt: number;
}

export function AccountSetup({ mode }: { mode: keyof typeof COPY }) {
  const copy = COPY[mode];
  const router = useRouter();
  const { user, signIn } = useSession();
  const [step, setStep] = useState<"identify" | "verify" | "password">("identify");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ActivationRequestInput>({
    resolver: zodResolver(activationRequestSchema),
    defaultValues: { identifier: "", email: "" },
  });

  useEffect(() => {
    if (user) router.replace(ROLE_HOME[user.role]);
  }, [user, router]);

  const sendCode = async () => {
    const result = await api.requestActivation(form.getValues());
    const now = Date.now();
    setChallenge({
      maskedEmail: result.maskedEmail,
      expiresAt: now + result.expiresInSeconds * 1000,
      resendAt: now + result.resendInSeconds * 1000,
    });
    setStep("verify");
  };

  const identify = form.handleSubmit(async () => {
    setError(null);
    try {
      await sendCode();
    } catch (reason) {
      setError(errorMessage(reason));
    }
  });

  const finish = async (password: string) => {
    await api.completeActivation({ token: token!, password });
    const signedIn = await signIn({ identifier: form.getValues("identifier"), password });
    toast.success(copy.done);
    router.replace(ROLE_HOME[signedIn.role]);
  };

  return (
    <AuthLayout
      image={{ src: "/images/study-group.jpg", alt: "Students working together around a laptop in a lecture hall" }}
      headline="Set up your portal account in a few minutes."
      points={[
        { icon: MailCheck, title: "Verified by email", description: "We confirm it's you with a code sent to the email on your record." },
        { icon: ShieldCheck, title: "Private to you", description: "Only you and authorised university staff can see your records." },
      ]}
      topAction={
        step === "verify" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Wrong email?
            <Button variant="outline" size="sm" onClick={() => setStep("identify")}>
              Change
            </Button>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Already set up?</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </p>
        )
      }
      demo={
        usingMocks && (
          <DemoAccounts
            show="code"
            selected={form.watch("identifier")}
            onPick={
              step === "identify"
                ? (account) => {
                    setError(null);
                    form.reset({ identifier: account.identifier, email: account.email });
                  }
                : undefined
            }
          />
        )
      }
    >
      {step === "identify" && (
        <>
          <AuthHeading icon={copy.icon} title={copy.title} description={copy.description} />
          <form onSubmit={identify} noValidate className="mt-8 space-y-4">
            {error && (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FloatingField control={form.control} name="identifier" label="Staff/Student ID" autoComplete="username" autoFocus />
            <FloatingField control={form.control} name="email" label="Email on your record" type="email" autoComplete="email" />
            <Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}
              Send code
            </Button>
          </form>
        </>
      )}

      {step === "verify" && challenge && (
        <VerifyStep
          challenge={challenge}
          onResend={sendCode}
          onVerify={async (code) => {
            const result = await api.verifyActivation({ identifier: form.getValues("identifier"), code });
            setToken(result.token);
            setStep("password");
          }}
        />
      )}

      {step === "password" && <PasswordStep title={copy.passwordTitle} onSubmit={finish} />}
    </AuthLayout>
  );
}

function useSecondsLeft(deadline: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const emptyCode = () => Array.from({ length: 6 }, () => "");

interface VerifyStepProps {
  challenge: Challenge;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
}

function VerifyStep({ challenge, onVerify, onResend }: VerifyStepProps) {
  const [digits, setDigits] = useState(emptyCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const expiresIn = useSecondsLeft(challenge.expiresAt);
  const resendIn = useSecondsLeft(challenge.resendAt);
  const code = digits.join("");

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const paste = async () => {
    try {
      const pasted = (await navigator.clipboard.readText()).replace(/\D/g, "");
      setDigits(emptyCode().map((_, index) => pasted[index] ?? ""));
    } catch {
      toast.error("Couldn't read the clipboard. Paste the code into the first box instead.");
    }
  };

  const resend = async () => {
    setError(null);
    try {
      await onResend();
      setDigits(emptyCode());
      toast.success("We sent you a new code.");
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  return (
    <>
      <AuthHeading
        icon={MailOpen}
        title="Check your inbox"
        description={
          <>
            We sent a 6-digit code to <span className="font-medium text-foreground">{challenge.maskedEmail}</span>. Enter it below to
            continue.
          </>
        }
      />
      <form onSubmit={verify} noValidate className="mt-8">
        <p className="mb-2 text-sm font-medium" aria-hidden>
          Verification code
        </p>
        <CodeInput
          digits={digits}
          onChange={(next) => {
            setDigits(next);
            setError(null);
          }}
          invalid={!!error}
          disabled={busy}
        />
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Timer className="size-3.5" aria-hidden />
            {expiresIn > 0 ? `Code expires in ${clock(expiresIn)}` : "This code has expired"}
          </p>
          <button type="button" onClick={paste} className="font-medium underline-offset-4 hover:underline">
            Paste code
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-6 h-12 w-full rounded-xl" disabled={code.length < 6 || busy || expiresIn === 0}>
          {busy && <Spinner />}
          Verify code
        </Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Didn&apos;t get it?{" "}
          {resendIn > 0 ? (
            <span className="tabular-nums">Resend code in {clock(resendIn)}</span>
          ) : (
            <button type="button" onClick={resend} className="font-medium text-foreground underline-offset-4 hover:underline">
              Resend code
            </button>
          )}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-11 rounded-xl" asChild>
            <a href="https://mail.google.com" target="_blank" rel="noreferrer">
              <Mail />
              Open Gmail
            </a>
          </Button>
          <Button variant="outline" className="h-11 rounded-xl" asChild>
            <a href="https://outlook.office.com/mail" target="_blank" rel="noreferrer">
              <Mail />
              Open Outlook
            </a>
          </Button>
        </div>
      </form>
    </>
  );
}

function PasswordStep({ title, onSubmit }: { title: string; onSubmit: (password: string) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const { isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await onSubmit(values.password);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  });

  return (
    <>
      <AuthHeading icon={KeyRound} title={title} description="Use at least 8 characters, with at least one letter and one number." />
      <form onSubmit={submit} noValidate className="mt-8 space-y-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FloatingField control={form.control} name="password" label="New password" type="password" autoComplete="new-password" autoFocus />
        <FloatingField control={form.control} name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
        <Button type="submit" size="lg" className="h-12 w-full rounded-xl" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Save and sign in
        </Button>
      </form>
    </>
  );
}
