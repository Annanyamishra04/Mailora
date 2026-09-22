"use client";

import { Loader2, RotateCw, Wand2 } from "lucide-react";
import type { EmailLength, EmailTone } from "@/lib/types";
import { EMAIL_LENGTHS, EMAIL_TONES } from "@/lib/types";
import type { ReplyFormErrors } from "@/lib/validation/reply";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AiInsightsMenu } from "@/components/reply/ai-insights-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface GenerationControlsProps {
  originalEmail: string;
  onOriginalEmailChange: (value: string) => void;
  tone: EmailTone;
  onToneChange: (value: EmailTone) => void;
  length: EmailLength;
  onLengthChange: (value: EmailLength) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  errors: ReplyFormErrors;
  isGenerating: boolean;
  hasResult: boolean;
  onGenerate: () => void;
}

export function GenerationControls({
  originalEmail,
  onOriginalEmailChange,
  tone,
  onToneChange,
  length,
  onLengthChange,
  instructions,
  onInstructionsChange,
  errors,
  isGenerating,
  hasResult,
  onGenerate,
}: GenerationControlsProps) {
  return (
    <div className="space-y-5 rounded-lg border border-line bg-paper-raised p-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="original-email">Original email</Label>
          <AiInsightsMenu email={originalEmail} disabled={isGenerating} />
        </div>
        <Textarea
          id="original-email"
          rows={9}
          placeholder="Paste the email you received here…"
          value={originalEmail}
          onChange={(e) => onOriginalEmailChange(e.target.value)}
          aria-invalid={Boolean(errors.originalEmail)}
          aria-describedby={errors.originalEmail ? "original-email-error" : undefined}
          className={cn(
            "leading-relaxed",
            errors.originalEmail && "border-danger focus-visible:border-danger focus-visible:ring-danger/20",
          )}
        />
        {errors.originalEmail ? (
          <p id="original-email-error" className="text-[12.5px] text-danger">
            {errors.originalEmail}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reply-tone">Tone</Label>
          <Select value={tone} onValueChange={(v) => onToneChange(v as EmailTone)}>
            <SelectTrigger id="reply-tone">
              <SelectValue placeholder="Tone" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reply-length">Length</Label>
          <Select value={length} onValueChange={(v) => onLengthChange(v as EmailLength)}>
            <SelectTrigger id="reply-length">
              <SelectValue placeholder="Length" />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_LENGTHS.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reply-instructions">
          Additional instructions <span className="text-ink-faint">(optional)</span>
        </Label>
        <Textarea
          id="reply-instructions"
          rows={2}
          placeholder="e.g. Confirm the meeting but ask to push it to Thursday."
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
        />
      </div>

      <Button
        type="button"
        size="lg"
        variant="teal"
        className="w-full"
        onClick={onGenerate}
        disabled={isGenerating}
        aria-busy={isGenerating}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : hasResult ? (
          <RotateCw className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Wand2 className="h-4 w-4" strokeWidth={1.75} />
        )}
        {isGenerating
          ? hasResult
            ? "Regenerating…"
            : "Generating reply…"
          : hasResult
            ? "Regenerate"
            : "Generate reply"}
      </Button>
    </div>
  );
}
