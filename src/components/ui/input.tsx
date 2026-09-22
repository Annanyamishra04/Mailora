import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full rounded-md border border-line-strong bg-paper-raised px-3 text-sm text-ink placeholder:text-ink-faint transition-colors outline-none",
        "focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
