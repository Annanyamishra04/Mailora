"use client";

import { AlertTriangle, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Shown when the session ends while a protected page is open. Deliberately
 * NOT an automatic redirect: the user may be mid-draft, and a hard
 * navigation would throw that text away. The banner stays until they log
 * in again (or dismiss it), and links back to the page they were on.
 */
export function SessionExpiredBanner({ onDismiss }: { onDismiss: () => void }) {
  const pathname = usePathname();
  const returnTo =
    typeof window === "undefined" ? pathname : `${window.location.pathname}${window.location.search}`;
  const href = `/login?reason=expired&redirectTo=${encodeURIComponent(returnTo ?? "/dashboard")}`;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 border-b border-danger/30 bg-paper-raised shadow-sm"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-3 text-[13.5px] sm:items-center">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger sm:mt-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-ink">
          <span className="font-medium">Your session has ended.</span>{" "}
          <span className="text-ink-soft">
            Changes on this page aren&apos;t being saved. Copy anything you need, then log in again.
          </span>
        </p>
        <Button asChild size="sm" variant="outline">
          <a href={href}>Log in again</a>
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss session notice"
          className="rounded-md p-1 text-ink-soft hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
