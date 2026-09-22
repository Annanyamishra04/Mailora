import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-teal-tint text-teal-strong">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-[17px] font-medium text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-ink-faint">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
