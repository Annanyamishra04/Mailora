"use client";

import Link from "next/link";
import { Star, Trash2, PenSquare } from "lucide-react";
import type { SavedEmail } from "@/lib/types";
import { EMAIL_TONES } from "@/lib/types";
import { RECORD_TYPE_BADGE, editHrefFor } from "@/lib/email-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EmailListItem({
  email,
  onToggleFavorite,
  onDelete,
}: {
  email: SavedEmail;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const toneLabel = EMAIL_TONES.find((t) => t.value === email.tone)?.label ?? email.tone;
  const preview = email.body.replace(/\s+/g, " ").trim();
  const editHref = editHrefFor(email);
  const typeBadge = RECORD_TYPE_BADGE[email.type];

  return (
    <div className="group flex items-start gap-4 border-b border-line py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggleFavorite(email.id)}
        aria-pressed={email.favorite}
        aria-label={email.favorite ? "Remove from favorites" : "Add to favorites"}
        className="mt-0.5 shrink-0 text-ink-faint transition-colors hover:text-gold"
      >
        <Star
          className={cn("h-4 w-4", email.favorite && "fill-gold text-gold")}
          strokeWidth={1.75}
        />
      </button>

      <Link href={editHref} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14.5px] font-medium text-ink">
            {email.subject || "Untitled draft"}
          </p>
          <Badge variant={typeBadge.variant} className="shrink-0">
            {typeBadge.label}
          </Badge>
          <Badge variant="neutral" className="shrink-0">
            {toneLabel}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-faint">
          {email.recipient ? `To ${email.recipient} — ` : ""}
          {preview || "No content yet"}
        </p>
      </Link>

      <div className="flex shrink-0 items-center gap-3">
        <p className="hidden text-[12.5px] text-ink-faint sm:block">
          {formatRelativeDate(email.updatedAt)}
        </p>
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href={editHref} aria-label={`Open and edit: ${email.subject.trim() || "untitled email"}`}>
            <PenSquare className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-ink-faint hover:text-danger"
          onClick={() => onDelete(email.id)}
          aria-label={`Delete: ${email.subject.trim() || "untitled email"}`}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
