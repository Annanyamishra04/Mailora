import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-md border border-line-strong bg-paper-raised px-3 py-2.5 text-sm text-ink leading-relaxed placeholder:text-ink-faint transition-colors outline-none",
        "focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
