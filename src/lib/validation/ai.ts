import { EMAIL_LENGTHS, EMAIL_TONES, type EmailLength, type EmailTone } from "@/lib/types";
import { REWRITE_ACTIONS, type RewriteAction } from "@/lib/ai/types";
import type {
  ActionItemsInput,
  GenerateEmailInput,
  GenerateReplyInput,
  GenerateSubjectInput,
  RewriteEmailInput,
  SummarizeEmailInput,
} from "@/lib/ai/types";
import {
  isRecord,
  readEnum,
  readString,
  rejectUnknownKeys,
  type ValidationResult,
} from "./common";

/**
 * Server-side validation for every AI API route. Client-side validation
 * (see `lib/validation/email.ts`) exists for good UX, but nothing here
 * trusts it — every field is re-checked on the server, since request
 * bodies can come from anywhere.
 *
 * Phase 6: unknown fields are now rejected (a typo'd or probing field is
 * an error, not silently ignored), and strings containing characters that
 * can't be stored/processed (NUL, lone surrogates) are refused up front.
 * The per-field length limits are unchanged from Phase 5.
 */

export type { ValidationResult };

export const AI_LIMITS = {
  recipient: 200,
  purpose: 2000,
  additionalInstructions: 1000,
  signatureName: 100,
  body: 20_000,
  originalEmail: 20_000,
  analysisEmail: 20_000,
} as const;

const TONE_VALUES = new Set<string>(EMAIL_TONES.map((t) => t.value));
const LENGTH_VALUES = new Set<string>(EMAIL_LENGTHS.map((l) => l.value));
const REWRITE_ACTION_VALUES = new Set<string>(REWRITE_ACTIONS);

const NOT_AN_OBJECT = "Request body must be a JSON object.";

export function validateGenerateEmailRequest(
  body: unknown,
): ValidationResult<GenerateEmailInput> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, [
    "recipient",
    "purpose",
    "tone",
    "length",
    "additionalInstructions",
    "signatureName",
  ]);
  if (unknownKey) return { valid: false, error: unknownKey };

  const recipient = readString(body, "recipient", {
    required: true,
    maxLength: AI_LIMITS.recipient,
    trim: true,
  });
  if (!recipient.ok) return { valid: false, error: recipient.error };

  const purpose = readString(body, "purpose", {
    required: true,
    maxLength: AI_LIMITS.purpose,
    trim: true,
  });
  if (!purpose.ok) return { valid: false, error: purpose.error };

  const additionalInstructions = readString(body, "additionalInstructions", {
    required: false,
    maxLength: AI_LIMITS.additionalInstructions,
    trim: true,
  });
  if (!additionalInstructions.ok) return { valid: false, error: additionalInstructions.error };

  const signatureName = readString(body, "signatureName", {
    required: false,
    maxLength: AI_LIMITS.signatureName,
    trim: true,
  });
  if (!signatureName.ok) return { valid: false, error: signatureName.error };

  const tone = readEnum<EmailTone>(body, "tone", TONE_VALUES);
  if (!tone.ok) return { valid: false, error: tone.error };

  const length = readEnum<EmailLength>(body, "length", LENGTH_VALUES);
  if (!length.ok) return { valid: false, error: length.error };

  return {
    valid: true,
    data: {
      recipient: recipient.value,
      purpose: purpose.value,
      tone: tone.value,
      length: length.value,
      additionalInstructions: additionalInstructions.value || undefined,
      signatureName: signatureName.value || undefined,
    },
  };
}

export function validateRewriteRequest(body: unknown): ValidationResult<RewriteEmailInput> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, ["body", "action"]);
  if (unknownKey) return { valid: false, error: unknownKey };

  const bodyText = readString(body, "body", {
    required: true,
    maxLength: AI_LIMITS.body,
    trim: true,
  });
  if (!bodyText.ok) return { valid: false, error: bodyText.error };

  const action = readEnum<RewriteAction>(body, "action", REWRITE_ACTION_VALUES);
  if (!action.ok) return { valid: false, error: action.error };

  return { valid: true, data: { body: bodyText.value, action: action.value } };
}

export function validateGenerateReplyRequest(
  body: unknown,
): ValidationResult<GenerateReplyInput> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, ["originalEmail", "tone", "length", "instructions"]);
  if (unknownKey) return { valid: false, error: unknownKey };

  const originalEmail = readString(body, "originalEmail", {
    required: true,
    maxLength: AI_LIMITS.originalEmail,
    trim: true,
  });
  if (!originalEmail.ok) return { valid: false, error: originalEmail.error };

  const instructions = readString(body, "instructions", {
    required: false,
    maxLength: AI_LIMITS.additionalInstructions,
    trim: true,
  });
  if (!instructions.ok) return { valid: false, error: instructions.error };

  const tone = readEnum<EmailTone>(body, "tone", TONE_VALUES);
  if (!tone.ok) return { valid: false, error: tone.error };

  const length = readEnum<EmailLength>(body, "length", LENGTH_VALUES);
  if (!length.ok) return { valid: false, error: length.error };

  return {
    valid: true,
    data: {
      originalEmail: originalEmail.value,
      tone: tone.value,
      length: length.value,
      instructions: instructions.value || undefined,
    },
  };
}

export function validateGenerateSubjectRequest(
  body: unknown,
): ValidationResult<GenerateSubjectInput> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, ["body", "purpose"]);
  if (unknownKey) return { valid: false, error: unknownKey };

  const bodyText = readString(body, "body", {
    required: false,
    maxLength: AI_LIMITS.body,
    trim: true,
  });
  if (!bodyText.ok) return { valid: false, error: bodyText.error };

  const purpose = readString(body, "purpose", {
    required: false,
    maxLength: AI_LIMITS.purpose,
    trim: true,
  });
  if (!purpose.ok) return { valid: false, error: purpose.error };

  if (!bodyText.value && !purpose.value) {
    return { valid: false, error: 'Provide "body" or "purpose" to generate a subject from.' };
  }

  return {
    valid: true,
    data: { body: bodyText.value, purpose: purpose.value || undefined },
  };
}

function validateEmailOnly(body: unknown): ValidationResult<{ email: string }> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, ["email"]);
  if (unknownKey) return { valid: false, error: unknownKey };

  const email = readString(body, "email", {
    required: true,
    maxLength: AI_LIMITS.analysisEmail,
    trim: true,
  });
  if (!email.ok) return { valid: false, error: email.error };

  return { valid: true, data: { email: email.value } };
}

export function validateSummarizeRequest(
  body: unknown,
): ValidationResult<SummarizeEmailInput> {
  return validateEmailOnly(body);
}

export function validateActionItemsRequest(
  body: unknown,
): ValidationResult<ActionItemsInput> {
  return validateEmailOnly(body);
}
