import { Loader2 } from "lucide-react";

/**
 * Suspense fallback for pages whose workspace reads the URL
 * (`useSearchParams`). Announced to assistive tech as a polite status, and
 * the spinner honours `prefers-reduced-motion` via the global rule in
 * `globals.css`.
 */
export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] items-center justify-center gap-2 text-[13.5px] text-ink-soft"
    >
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
