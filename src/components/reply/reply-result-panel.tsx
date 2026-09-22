"use client";

import { Copy, Loader2, MailOpen, Save, Trash2, Sparkles, FileEdit } from "lucide-react";
import type { RewriteAction } from "@/lib/ai/types";
import type { EmailType } from "@/lib/types";
import { RECORD_TYPE_BADGE } from "@/lib/email-display";
import { wordCount } from "@/lib/text";
import { AiErrorState } from "@/components/shared/ai-error-state";
import { AiLoadingState } from "@/components/shared/ai-loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { RewriteToolbar } from "@/components/shared/rewrite-toolbar";
import { AutosaveIndicator, type AutosaveStatus } from "@/components/shared/autosave-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export interface ReplyResultPanelProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  isGenerating: boolean;
  error: string | null;
  onRetry: () => void;
  onRewrite: (action: RewriteAction) => void;
  activeRewrite: RewriteAction | null;
  onGenerateSubject: () => void;
  isGeneratingSubject: boolean;
  onCopy: () => void;
  isCopying: boolean;
  onClear: () => void;
  onSave: () => void;
  isSaving: boolean;
  recordType?: EmailType | null;
  onSaveDraft?: () => void;
  isSavingDraft?: boolean;
  onDeleteDraft?: () => void;
  isDeletingDraft?: boolean;
  autosaveStatus?: AutosaveStatus;
}

export function ReplyResultPanel({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  isGenerating,
  error,
  onRetry,
  onRewrite,
  activeRewrite,
  onGenerateSubject,
  isGeneratingSubject,
  onCopy,
  isCopying,
  onClear,
  onSave,
  isSaving,
  recordType,
  onSaveDraft,
  isSavingDraft,
  onDeleteDraft,
  isDeletingDraft,
  autosaveStatus = "idle",
}: ReplyResultPanelProps) {
  const hasResult = Boolean(subject.trim() || body.trim());
  const words = wordCount(body);
  const badge = recordType ? RECORD_TYPE_BADGE[recordType] : null;

  if (!hasResult && isGenerating) {
    return (
      <div className="rounded-lg border border-line bg-paper-raised">
        <AiLoadingState label="Writing a reply…" />
      </div>
    );
  }

  if (!hasResult && error) {
    return (
      <div className="rounded-lg border border-line bg-paper-raised">
        <AiErrorState message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!hasResult) {
    return (
      <div className="rounded-lg border border-line bg-paper-raised">
        <EmptyState
          icon={MailOpen}
          title="No reply yet"
          description="Paste the email you received on the left, choose a tone and length, then generate a reply to edit here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-lg border border-line bg-paper-raised">
      <div className="border-b border-line px-4 py-3">
        <RewriteToolbar
          onAction={onRewrite}
          activeAction={activeRewrite}
          disabled={body.trim().length === 0 || isGenerating}
        />
      </div>

      {error ? (
        <div className="border-b border-danger/30 bg-danger/5 px-5 py-3">
          <p className="text-[12.5px] text-danger">{error}</p>
        </div>
      ) : null}

      <div className="flex-1 space-y-4 px-5 py-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="reply-subject">Suggested subject</Label>
            <button
              type="button"
              onClick={onGenerateSubject}
              disabled={isGeneratingSubject || isGenerating}
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
            id="reply-subject"
            placeholder="Your generated subject line will appear here"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reply-body">Reply</Label>
          <Textarea
            id="reply-body"
            rows={14}
            placeholder="Your generated reply will appear here, ready to edit before you send it."
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            disabled={isGenerating}
            className="leading-relaxed"
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
          {isGenerating ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
              Regenerating…
            </span>
          ) : (
            <>
              <span>
                {words} {words === 1 ? "word" : "words"}
              </span>
              {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
              <AutosaveIndicator status={autosaveStatus} />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCopy} disabled={isCopying}>
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            Copy
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Clear
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
