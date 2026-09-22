import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function PreviewNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-line bg-teal-tint/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-teal-strong",
        className,
      )}
    >
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <p>{children}</p>
    </div>
  );
}
