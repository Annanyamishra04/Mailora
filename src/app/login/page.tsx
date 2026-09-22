"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { safeRedirectPath } from "@/lib/routes";
import { PageLoading } from "@/components/shared/page-loading";

/** Known `?error=` codes from `/auth/callback`; anything else is ignored, never echoed. */
const CALLBACK_ERRORS: Record<string, string> = {
  callback:
    "We couldn't complete that sign-in link. It may have expired or been opened on a different device — log in below.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-origin paths are honoured — a crafted ?redirectTo=https://evil.example
  // must never send a freshly logged-in user off-site (open redirect).
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));
  const sessionExpired = searchParams.get("reason") === "expired";
  const callbackError = CALLBACK_ERRORS[searchParams.get("error") ?? ""];

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(toAuthErrorMessage(signInError));
        return;
      }

      // The proxy reads the session from cookies on the next navigation;
      // refresh() re-runs server components with that session so the
      // dashboard renders as signed-in on the very first paint.
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in to your account"
      description="Pick up where you left off drafting."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-teal hover:underline">
            Sign up free
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {sessionExpired || callbackError ? (
          <p role="status" className="rounded-md border border-line bg-paper-raised px-3 py-2 text-[13px] text-ink-soft">
            {callbackError ?? "Your session expired. Log in again to continue where you left off."}
          </p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>

        {error ? (
          <p id="login-error" role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" variant="teal" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<PageLoading />}>
      <LoginForm />
    </React.Suspense>
  );
}
