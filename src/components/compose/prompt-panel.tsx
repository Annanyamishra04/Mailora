"use client";

import { Loader2, Wand2 } from "lucide-react";
import type { EmailLength, EmailTone } from "@/lib/types";
import { EMAIL_LENGTHS, EMAIL_TONES } from "@/lib/types";
import type { ComposeFormErrors } from "@/lib/validation/email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PromptPanelProps {
  recipient: string;
  onRecipientChange: (value: string) => void;
  purpose: string;
  onPurposeChange: (value: string) => void;
  tone: EmailTone;
  onToneChange: (value: EmailTone) => void;
  length: EmailLength;
  onLengthChange: (value: EmailLength) => void;
  additionalInstructions: string;
  onAdditionalInstructionsChange: (value: string) => void;
  errors: ComposeFormErrors;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function PromptPanel({
  recipient,
  onRecipientChange,
  purpose,
  onPurposeChange,
  tone,
  onToneChange,
  length,
  onLengthChange,
  additionalInstructions,
  onAdditionalInstructionsChange,
  errors,
  isGenerating,
  onGenerate,
}: PromptPanelProps) {
  return (
    <div className="space-y-5 rounded-lg border border-line bg-paper-raised p-5">
      <div className="space-y-1.5">
        <Label htmlFor="recipient">Recipient</Label>
        <Input
          id="recipient"
          placeholder="e.g. Priya, a prospective client"
          value={recipient}
          onChange={(e) => onRecipientChange(e.target.value)}
          aria-invalid={Boolean(errors.recipient)}
          aria-describedby={errors.recipient ? "recipient-error" : undefined}
          className={cn(errors.recipient && "border-danger focus-visible:border-danger focus-visible:ring-danger/20")}
        />
        {errors.recipient ? (
          <p id="recipient-error" className="text-[12.5px] text-danger">
            {errors.recipient}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purpose">What do you need to say?</Label>
        <Textarea
          id="purpose"
          rows={5}
          placeholder="e.g. Follow up on the proposal I sent Tuesday and ask if they have questions."
          value={purpose}
          onChange={(e) => onPurposeChange(e.target.value)}
          aria-invalid={Boolean(errors.purpose)}
          aria-describedby={errors.purpose ? "purpose-error" : undefined}
          className={cn(errors.purpose && "border-danger focus-visible:border-danger focus-visible:ring-danger/20")}
        />
        {errors.purpose ? (
          <p id="purpose-error" className="text-[12.5px] text-danger">
            {errors.purpose}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tone">Tone</Label>
          <Select value={tone} onValueChange={(v) => onToneChange(v as EmailTone)}>
            <SelectTrigger id="tone">
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
          <Label htmlFor="length">Length</Label>
          <Select value={length} onValueChange={(v) => onLengthChange(v as EmailLength)}>
            <SelectTrigger id="length">
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
        <Label htmlFor="instructions">
          Additional instructions <span className="text-ink-faint">(optional)</span>
        </Label>
        <Textarea
          id="instructions"
          rows={2}
          placeholder="e.g. Mention the new pricing takes effect in March."
          value={additionalInstructions}
          onChange={(e) => onAdditionalInstructionsChange(e.target.value)}
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
        ) : (
          <Wand2 className="h-4 w-4" strokeWidth={1.75} />
        )}
        {isGenerating ? "Generating draft…" : "Generate draft"}
      </Button>
    </div>
  );
}
