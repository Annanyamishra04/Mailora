import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiLoadingState({
  label = "Generating…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-16 text-center",
        className,
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-teal" strokeWidth={1.75} />
      <p className="text-[13.5px] text-ink-faint">{label}</p>
    </div>
  );
}
