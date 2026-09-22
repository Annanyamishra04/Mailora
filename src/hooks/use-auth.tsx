"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  SESSION_EXPIRED_EVENT,
  resetIntentionalSignOut,
  wasIntentionalSignOut,
} from "@/lib/api-client";
import { isProtectedPath } from "@/lib/routes";
import { SessionExpiredBanner } from "@/components/layout/session-expired-banner";

interface AuthContextValue {
  user: User | null;
  /** True until the initial session check completes. */
  isLoading: boolean;
  /** True if Supabase env vars are missing, so auth UI can show a setup message. */
  isConfigured: boolean;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isConfigured: true,
});

/**
 * Wraps the app once (see `app/layout.tsx`) so any client component can
 * call `useAuth()` instead of re-checking the session itself. Page
 * protection lives in `src/proxy.ts` and API protection in
 * `src/lib/api/guard.ts` — this is purely for UI that wants to know who's
 * signed in (the sidebar profile, sign-out) and which store to use (see
 * `useEmails`).
 *
 * It also owns the "your session ended while this page was open" case:
 * either Supabase reports SIGNED_OUT (expired/revoked session, or signing
 * out in another tab) or an API call comes back 401. Rather than yanking
 * the user to /login — which would destroy whatever they were typing — it
 * shows a persistent banner with a log-in link, so they can copy their
 * work out first.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isConfigured, setIsConfigured] = React.useState(true);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  React.useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- Supabase env vars are missing; this resolves synchronously and only runs once on mount */
      setIsConfigured(false);
      setIsLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user ?? null);
      })
      .catch(() => {
        // Supabase unreachable: treat as signed out for now rather than
        // leaving the whole app on its loading state forever.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN") {
        resetIntentionalSignOut();
        setSessionExpired(false);
      } else if (
        event === "SIGNED_OUT" &&
        !wasIntentionalSignOut() &&
        isProtectedPath(pathnameRef.current ?? "")
      ) {
        setSessionExpired(true);
      }
    });

    const onExpired = () => setSessionExpired(true);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const value = React.useMemo(
    () => ({ user, isLoading, isConfigured }),
    [user, isLoading, isConfigured],
  );

  return (
    <AuthContext.Provider value={value}>
      {sessionExpired && isProtectedPath(pathname ?? "") ? (
        <SessionExpiredBanner onDismiss={() => setSessionExpired(false)} />
      ) : null}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return React.useContext(AuthContext);
}
