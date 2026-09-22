"use client";

import * as React from "react";
import { ChevronDown, ListChecks, Sparkles } from "lucide-react";
import { summarizeEmail, extractActionItems } from "@/lib/ai-client";
import type { ActionItemsResult, SummarizeEmailResult } from "@/lib/ai/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AiLoadingState } from "@/components/shared/ai-loading-state";
import { AiErrorState } from "@/components/shared/ai-error-state";

type Mode = "summarize" | "action-items";

/**
 * Real AI actions (not mocked): summarize the pasted email, or extract its
 * action items. Both call the server (`/api/ai/summarize-email`,
 * `/api/ai/action-items`), which never invents a deadline or owner that
 * wasn't explicitly stated.
 */
export function AiInsightsMenu({ email, disabled }: { email: string; disabled?: boolean }) {
  const { toast } = useToast();
  const [mode, setMode] = React.useState<Mode | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<SummarizeEmailResult | null>(null);
  const [actionItems, setActionItems] = React.useState<ActionItemsResult | null>(null);

  // Id of the newest request. A response only touches the UI if it still
  // belongs to the newest one — otherwise closing the dialog and starting a
  // different analysis lets the OLD response overwrite the new state, or its
  // `finally` switch the loading spinner off while the new request is still running.
  const requestIdRef = React.useRef(0);

  function run(nextMode: Mode) {
    // Don't fire a second identical AI call while one is already running.
    if (isLoading && mode === nextMode) return;

    if (!email.trim() || email.trim().length < 10) {
      toast({
        title: "Paste the email first",
        description: "Add the original email so it can be analyzed.",
        variant: "error",
      });
      return;
    }

    setMode(nextMode);
    setError(null);
    setSummary(null);
    setActionItems(null);
    setIsLoading(true);

    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;

    const request =
      nextMode === "summarize" ? summarizeEmail({ email }) : extractActionItems({ email });

    request
      .then((result) => {
        if (isStale()) return;
        if (nextMode === "summarize") {
          setSummary(result as SummarizeEmailResult);
        } else {
          setActionItems(result as ActionItemsResult);
        }
      })
      .catch((err: unknown) => {
        if (isStale()) return;
        setError(err instanceof Error ? err.message : "Please try again.");
      })
      .finally(() => {
        if (!isStale()) setIsLoading(false);
      });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            Analyze
            <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => run("summarize")}>Summarize</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run("action-items")}>Extract action items</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode !== null} onOpenChange={(open) => {
          if (open) return;
          // Closing abandons any in-flight analysis: its result must not reappear later.
          requestIdRef.current += 1;
          setIsLoading(false);
          setMode(null);
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "summarize" ? "Summary" : "Action items"}</DialogTitle>
            <DialogDescription>
              {mode === "summarize"
                ? "The main purpose, key points, and any explicit request or deadline."
                : "Tasks mentioned in the email, with an owner and deadline only when explicitly stated."}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <AiLoadingState label={mode === "summarize" ? "Summarizing…" : "Extracting action items…"} />
          ) : error ? (
            <AiErrorState message={error} onRetry={() => mode && run(mode)} />
          ) : mode === "summarize" && summary ? (
            <div className="space-y-4 text-[13.5px] leading-relaxed text-ink-soft">
              <p>{summary.purpose}</p>
              {summary.keyPoints.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5">
                  {summary.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              ) : null}
              <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <dt className="text-[12px] font-medium text-ink-faint">Requested action</dt>
                  <dd className="mt-0.5 text-ink">{summary.requestedAction ?? "None stated"}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-ink-faint">Deadline</dt>
                  <dd className="mt-0.5 text-ink">{summary.deadline ?? "None stated"}</dd>
                </div>
              </dl>
            </div>
          ) : mode === "action-items" && actionItems ? (
            actionItems.items.length > 0 ? (
              <ul className="space-y-3">
                {actionItems.items.map((item, i) => (
                  <li key={i} className="rounded-md border border-line px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-teal" strokeWidth={1.75} />
                      <div className="min-w-0 space-y-1">
                        <p className="text-[13.5px] text-ink">{item.task}</p>
                        <p className="text-[12px] text-ink-faint">
                          Owner: {item.owner ?? "Not specified"} · Deadline: {item.deadline ?? "Not specified"}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-ink-faint">No explicit action items found in this email.</p>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
