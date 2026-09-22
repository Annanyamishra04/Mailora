"use client";

import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToast, type ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-teal/30 [&_svg]:text-teal",
  error: "border-danger/30 [&_svg]:text-danger",
  info: "border-line-strong [&_svg]:text-ink-soft",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  // The live region stays mounted even when empty: screen readers only
  // announce changes inside a live region that already exists, so one that
  // appears together with its first message is often silent.
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-4 md:items-end"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            // Errors interrupt (assertive); everything else waits its turn.
            role={t.variant === "error" ? "alert" : undefined}
            className={cn(
              "animate-in slide-in-from-bottom-2 fade-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border bg-paper-raised px-4 py-3 shadow-lg",
              VARIANT_STYLES[t.variant],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">{t.title}</p>
              {t.description ? (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                  {t.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-sm text-ink-faint transition-colors hover:text-ink"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
