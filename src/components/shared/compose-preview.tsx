import { Star, Wand2 } from "lucide-react";

const TONES = ["Direct", "Warm", "Formal"] as const;

export function ComposePreview() {
  return (
    <div className="w-full max-w-md rounded-lg border border-line bg-paper-raised shadow-[0_1px_2px_rgba(22,24,31,0.04),0_12px_32px_-16px_rgba(22,24,31,0.18)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-ink-soft">
          <Wand2 className="h-3.5 w-3.5 text-teal" strokeWidth={1.75} />
          Compose
        </div>
        <Star className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((tone, i) => (
            <span
              key={tone}
              className={
                i === 0
                  ? "rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper dark:bg-teal dark:text-ink"
                  : "rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink-faint"
              }
            >
              {tone}
            </span>
          ))}
          <span className="rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-medium text-ink-faint">
            ~120 words
          </span>
        </div>

        <div className="rounded-md border border-line bg-paper px-3.5 py-3">
          <p className="text-[11px] font-medium text-ink-faint">Subject</p>
          <p className="mt-0.5 text-[13.5px] font-medium text-ink">
            Following up on the Tuesday proposal
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-line bg-paper px-3.5 py-3">
          <div className="h-2 w-11/12 rounded-full bg-line-strong" />
          <div className="h-2 w-full rounded-full bg-line-strong" />
          <div className="h-2 w-4/5 rounded-full bg-line-strong" />
          <div className="h-2 w-9/12 rounded-full bg-line-strong" />
        </div>
      </div>
    </div>
  );
}
