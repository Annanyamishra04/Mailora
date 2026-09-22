"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for every route below the root layout. Shows a friendly
 * message and a retry — never the error's message or stack, which can hold
 * internals. `digest` is Next's opaque id for the server-side log entry, so
 * it's safe to show and lets a report be matched to the logs.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[ui] unhandled error", error.digest ?? "");
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      <Logo className="mb-10" />
      <p className="font-display text-[15px] text-danger">Something broke</p>
      <h1 className="mt-2 font-display text-[26px] font-medium tracking-tight text-ink">
        That didn&apos;t go as planned
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-ink-faint">
        An unexpected error occurred. Your saved emails are safe. Try again, or head back to the
        dashboard.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[11.5px] text-ink-faint">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="teal" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
