"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import type { LoginInput } from "@/lib/schemas";
import type { SessionUser } from "@/lib/types";

type Status = "loading" | "authenticated" | "anonymous";

interface SessionContextValue {
  user: SessionUser | null;
  status: Status;
  signIn: (input: LoginInput) => Promise<SessionUser>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    api
      .getSession()
      .then((current) => {
        setUser(current);
        setStatus(current ? "authenticated" : "anonymous");
      })
      .catch(() => setStatus("anonymous"));
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    const signedIn = await api.login(input);
    setUser(signedIn);
    setStatus("authenticated");
    return signedIn;
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo(() => ({ user, status, signIn, signOut }), [user, status, signIn, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
