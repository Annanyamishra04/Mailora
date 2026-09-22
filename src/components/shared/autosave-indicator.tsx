import { Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function AutosaveIndicator({ status, className }: { status: AutosaveStatus; className?: string }) {
  // Always render the live-region wrapper (empty and visually hidden when
  // idle) so screen readers announce "Draft saved" / "Unable to save draft"
  // when they appear, rather than ignoring a region created with its text.
  if (status === "idle") {
    return <span role="status" aria-live="polite" className="sr-only" />;
  }

  const config = {
    saving: { icon: Loader2, label: "Saving draft…", tone: "text-ink-faint", spin: true },
    saved: { icon: Check, label: "Draft saved", tone: "text-teal", spin: false },
    error: { icon: AlertCircle, label: "Unable to save draft", tone: "text-danger", spin: false },
  }[status];

  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1 text-[12.5px]", config.tone, className)}
    >
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} strokeWidth={1.75} aria-hidden="true" />
      {config.label}
    </span>
  );
}
