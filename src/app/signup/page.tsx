"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toAuthErrorMessage } from "@/lib/supabase/auth-errors";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!email.trim() || !password || !confirmPassword) {
      setError("Fill in your email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          ...(name.trim() ? { data: { full_name: name.trim() } } : {}),
          // Sends the confirmation link through /auth/callback so the
          // person lands signed in. Ignored (falls back to the Site URL)
          // unless this URL is on the Supabase redirect allow-list.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (signUpError) {
        setError(toAuthErrorMessage(signUpError));
        return;
      }

      // If the Supabase project has email confirmation enabled, `session`
      // is null here even though the account was created — the person
      // needs to click the link in their inbox before they can sign in.
      // We tell them that plainly rather than pretending they're in.
      if (!data.session) {
        setNeedsEmailConfirmation(true);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(toAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (needsEmailConfirmation) {
    return (
      <AuthLayout
        eyebrow="Almost there"
        title="Check your email"
        description="We sent a confirmation link to finish setting up your account."
        footer={
          <>
            Already confirmed?{" "}
            <Link href="/login" className="font-medium text-teal hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-md border border-line bg-teal-tint/60 px-3.5 py-3 text-[13.5px] leading-relaxed text-teal-strong">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <p>
            We sent a link to <span className="font-medium">{email}</span>. Open it to verify
            your email, then come back and log in.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your account"
      description="Free to start. No credit card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signup-error" : undefined}
            id="name"
            type="text"
            placeholder="Jordan Diaz"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signup-error" : undefined}
            id="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signup-error" : undefined}
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signup-error" : undefined}
            id="confirm-password"
            type="password"
            placeholder="Type it again"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {error ? (
          <p id="signup-error" role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" size="lg" variant="teal" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
