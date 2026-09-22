"use client";

import * as React from "react";
import { Copy, Loader2, Save, Star, ChevronDown, Sparkles, FileEdit, Trash2 } from "lucide-react";
import type { RewriteAction } from "@/lib/ai/types";
import type { EmailType } from "@/lib/types";
import { RECORD_TYPE_BADGE } from "@/lib/email-display";
import { wordCount } from "@/lib/text";
import { RewriteToolbar } from "@/components/shared/rewrite-toolbar";
import { AutosaveIndicator, type AutosaveStatus } from "@/components/shared/autosave-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface EmailEditorProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  cc: string;
  onCcChange: (value: string) => void;
  bcc: string;
  onBccChange: (value: string) => void;
  showCcBcc: boolean;
  onToggleCcBcc: () => void;
  onRewrite: (action: RewriteAction) => void;
  activeRewrite: RewriteAction | null;
  onGenerateSubject: () => void;
  isGeneratingSubject: boolean;
  onCopy: () => void;
  isCopying: boolean;
  onSave: () => void;
  isSaving: boolean;
  onToggleFavorite: () => void;
  isFavorite: boolean;
  /** Which kind of record this is currently saved as, if any — shown as a badge. */
  recordType?: EmailType | null;
  onSaveDraft?: () => void;
  isSavingDraft?: boolean;
  /** Present (and the button shown) only when there's a draft record to delete. */
  onDeleteDraft?: () => void;
  isDeletingDraft?: boolean;
  autosaveStatus?: AutosaveStatus;
}

export function EmailEditor({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  cc,
  onCcChange,
  bcc,
  onBccChange,
  showCcBcc,
  onToggleCcBcc,
  onRewrite,
  activeRewrite,
  onGenerateSubject,
  isGeneratingSubject,
  onCopy,
  isCopying,
  onSave,
  isSaving,
  onToggleFavorite,
  isFavorite,
  recordType,
  onSaveDraft,
  isSavingDraft,
  onDeleteDraft,
  isDeletingDraft,
  autosaveStatus = "idle",
}: EmailEditorProps) {
  const words = wordCount(body);
  const badge = recordType ? RECORD_TYPE_BADGE[recordType] : null;

  return (
    <div className="flex flex-col rounded-lg border border-line bg-paper-raised">
      <div className="border-b border-line px-4 py-3">
        <RewriteToolbar
          onAction={onRewrite}
          activeAction={activeRewrite}
          disabled={body.trim().length === 0}
        />
      </div>

      <div className="flex-1 space-y-4 px-5 py-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleCcBcc}
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink-faint transition-colors hover:text-ink"
            aria-expanded={showCcBcc}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showCcBcc && "rotate-180")}
              strokeWidth={1.75}
            />
            {showCcBcc ? "Hide Cc/Bcc" : "Add Cc/Bcc"}
          </button>
        </div>

        {showCcBcc ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc">Cc</Label>
              <Input id="cc" value={cc} onChange={(e) => onCcChange(e.target.value)} placeholder="cc@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bcc">Bcc</Label>
              <Input id="bcc" value={bcc} onChange={(e) => onBccChange(e.target.value)} placeholder="bcc@company.com" />
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="subject">Subject</Label>
            <button
              type="button"
              onClick={onGenerateSubject}
              disabled={isGeneratingSubject}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal transition-colors hover:text-teal-strong disabled:opacity-50"
            >
              {isGeneratingSubject ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
              ) : (
                <Sparkles className="h-3 w-3" strokeWidth={1.75} />
              )}
              Generate subject
            </button>
          </div>
          <Input
            id="subject"
            placeholder="Your generated subject line will appear here"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            rows={14}
            placeholder="Your generated draft will appear here, ready to edit before you send it."
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            className="leading-relaxed"
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
          <span>
            {words} {words === 1 ? "word" : "words"}
          </span>
          {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
          <AutosaveIndicator status={autosaveStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCopy} disabled={isCopying}>
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            Copy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
          >
            <Star
              className={cn("h-3.5 w-3.5", isFavorite && "fill-gold text-gold")}
              strokeWidth={1.75}
            />
            {isFavorite ? "Favorited" : "Favorite"}
          </Button>
          {onDeleteDraft ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDeleteDraft}
              disabled={isDeletingDraft}
              className="text-danger hover:bg-danger-tint hover:text-danger"
            >
              {isDeletingDraft ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              Delete draft
            </Button>
          ) : null}
          {onSaveDraft ? (
            <Button type="button" variant="outline" size="sm" onClick={onSaveDraft} disabled={isSavingDraft}>
              {isSavingDraft ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
              ) : (
                <FileEdit className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {recordType === "draft" ? "Update draft" : "Save draft"}
            </Button>
          ) : null}
          <Button type="button" variant="teal" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Save to history
          </Button>
        </div>
      </div>
    </div>
  );
}

