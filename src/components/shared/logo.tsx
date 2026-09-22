import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-[19px] font-medium tracking-tight text-ink",
        className,
      )}
    >
      <span className="relative flex h-6 w-6 items-center justify-center rounded-[5px] bg-ink text-paper dark:bg-teal dark:text-ink">
        <span className="font-display text-[13px] leading-none">M</span>
      </span>
      AI Mail Studio
    </span>
  );
}
