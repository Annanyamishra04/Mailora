"use client";

import {
  Wand2,
  Palette,
  Minimize2,
  Maximize2,
  SpellCheck2,
  Eye,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { TONE_REWRITE_ACTIONS, type RewriteAction } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Shared between Compose and Reply. Grouped rather than one button per
 * action (13 possible `RewriteAction`s) — "Change tone" folds the seven
 * tone rewrites into one menu, keeping the toolbar to five controls.
 */
const PLAIN_ACTIONS: { id: RewriteAction; label: string; icon: typeof Wand2 }[] = [
  { id: "shorten", label: "Shorten", icon: Minimize2 },
  { id: "expand", label: "Expand", icon: Maximize2 },
  { id: "fix-grammar", label: "Fix grammar", icon: SpellCheck2 },
  { id: "make-clearer", label: "Make clearer", icon: Eye },
];

export function RewriteToolbar({
  onAction,
  activeAction,
  disabled,
  className,
}: {
  onAction: (action: RewriteAction) => void;
  activeAction: RewriteAction | null;
  disabled?: boolean;
  className?: string;
}) {
  const isBusy = activeAction !== null;
  const isPolishing = activeAction === "polish";
  const isChangingTone = isBusy && TONE_REWRITE_ACTIONS.some((t) => t.action === activeAction);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || isBusy}
        onClick={() => onAction("polish")}
        aria-busy={isPolishing}
      >
        {isPolishing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
        ) : (
          <Wand2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
        Polish
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isBusy}
            aria-busy={isChangingTone}
          >
            {isChangingTone ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Palette className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Change tone
            <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TONE_REWRITE_ACTIONS.map(({ action, label }) => (
            <DropdownMenuItem key={action} onSelect={() => onAction(action)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {PLAIN_ACTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = activeAction === id;
        return (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isBusy}
            onClick={() => onAction(id)}
            aria-busy={isActive}
          >
            {isActive ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {label}
          </Button>
        );
      })}
    </div>
  );
}
