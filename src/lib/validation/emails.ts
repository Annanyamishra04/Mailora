import {
  EMAIL_LENGTHS,
  EMAIL_TONES,
  type EmailLength,
  type EmailTone,
  type EmailType,
  type NewSavedEmail,
} from "@/lib/types";
import {
  isRecord,
  readEnum,
  readOptionalBoolean,
  readString,
  rejectUnknownKeys,
  type ValidationResult,
} from "./common";

/**
 * Server-side validation for the email persistence API. Mirrors the style
 * of `lib/validation/ai.ts`: every field is re-checked here regardless of
 * what the client sent, and a client-supplied `user_id` (or `id`,
 * `createdAt`, `updatedAt`) is never read from the body — ownership and
 * identity always come from the verified session in the route handler.
 *
 * Phase 6: any field outside `WRITABLE_FIELDS` (including `user_id`) is now
 * rejected outright rather than silently ignored.
 */

export type { ValidationResult };

export const EMAIL_LIMITS = {
  recipient: 320,
  subject: 500,
  body: 30_000,
  purpose: 2000,
  additionalInstructions: 1000,
} as const;

const TONE_VALUES = new Set<string>(EMAIL_TONES.map((t) => t.value));
const LENGTH_VALUES = new Set<string>(EMAIL_LENGTHS.map((l) => l.value));
const TYPE_VALUES = new Set<string>(["generated", "reply", "draft"] satisfies EmailType[]);

/** The only fields a client may send. `user_id`, `id`, timestamps are never accepted. */
const WRITABLE_FIELDS = [
  "recipient",
  "subject",
  "body",
  "purpose",
  "additionalInstructions",
  "tone",
  "length",
  "type",
  "favorite",
] as const;

const NOT_AN_OBJECT = "Request body must be a JSON object.";

/** Validates the body of `POST /api/emails` (creating a saved email). */
export function validateCreateEmailRequest(body: unknown): ValidationResult<NewSavedEmail> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, WRITABLE_FIELDS);
  if (unknownKey) return { valid: false, error: unknownKey };

  const recipient = readString(body, "recipient", { required: false, maxLength: EMAIL_LIMITS.recipient });
  if (!recipient.ok) return { valid: false, error: recipient.error };

  const subject = readString(body, "subject", { required: false, maxLength: EMAIL_LIMITS.subject });
  if (!subject.ok) return { valid: false, error: subject.error };

  const bodyText = readString(body, "body", { required: false, maxLength: EMAIL_LIMITS.body });
  if (!bodyText.ok) return { valid: false, error: bodyText.error };

  const purpose = readString(body, "purpose", { required: false, maxLength: EMAIL_LIMITS.purpose });
  if (!purpose.ok) return { valid: false, error: purpose.error };

  const additionalInstructions = readString(body, "additionalInstructions", {
    required: false,
    maxLength: EMAIL_LIMITS.additionalInstructions,
  });
  if (!additionalInstructions.ok) return { valid: false, error: additionalInstructions.error };

  const tone = readEnum<EmailTone>(body, "tone", TONE_VALUES);
  if (!tone.ok) return { valid: false, error: tone.error };

  const length = readEnum<EmailLength>(body, "length", LENGTH_VALUES);
  if (!length.ok) return { valid: false, error: length.error };

  let type: EmailType = "generated";
  if (body.type !== undefined) {
    const parsed = readEnum<EmailType>(body, "type", TYPE_VALUES);
    if (!parsed.ok) return { valid: false, error: parsed.error };
    type = parsed.value;
  }

  const favorite = readOptionalBoolean(body, "favorite");
  if (!favorite.ok) return { valid: false, error: favorite.error };

  return {
    valid: true,
    data: {
      recipient: recipient.value,
      subject: subject.value,
      body: bodyText.value,
      tone: tone.value,
      length: length.value,
      purpose: purpose.value || undefined,
      additionalInstructions: additionalInstructions.value || undefined,
      type,
      favorite: favorite.value ?? false,
    },
  };
}

/** Validates the body of `PATCH /api/emails/[id]` (partial update). */
export function validateUpdateEmailRequest(
  body: unknown,
): ValidationResult<Partial<NewSavedEmail>> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, WRITABLE_FIELDS);
  if (unknownKey) return { valid: false, error: unknownKey };

  const data: Partial<NewSavedEmail> = {};

  if (body.recipient !== undefined) {
    const recipient = readString(body, "recipient", { required: false, maxLength: EMAIL_LIMITS.recipient });
    if (!recipient.ok) return { valid: false, error: recipient.error };
    data.recipient = recipient.value;
  }

  if (body.subject !== undefined) {
    const subject = readString(body, "subject", { required: false, maxLength: EMAIL_LIMITS.subject });
    if (!subject.ok) return { valid: false, error: subject.error };
    data.subject = subject.value;
  }

  if (body.body !== undefined) {
    const bodyText = readString(body, "body", { required: false, maxLength: EMAIL_LIMITS.body });
    if (!bodyText.ok) return { valid: false, error: bodyText.error };
    data.body = bodyText.value;
  }

  if (body.purpose !== undefined) {
    const purpose = readString(body, "purpose", { required: false, maxLength: EMAIL_LIMITS.purpose });
    if (!purpose.ok) return { valid: false, error: purpose.error };
    data.purpose = purpose.value || undefined;
  }

  if (body.additionalInstructions !== undefined) {
    const additionalInstructions = readString(body, "additionalInstructions", {
      required: false,
      maxLength: EMAIL_LIMITS.additionalInstructions,
    });
    if (!additionalInstructions.ok) return { valid: false, error: additionalInstructions.error };
    data.additionalInstructions = additionalInstructions.value || undefined;
  }

  if (body.tone !== undefined) {
    const tone = readEnum<EmailTone>(body, "tone", TONE_VALUES);
    if (!tone.ok) return { valid: false, error: tone.error };
    data.tone = tone.value;
  }

  if (body.length !== undefined) {
    const length = readEnum<EmailLength>(body, "length", LENGTH_VALUES);
    if (!length.ok) return { valid: false, error: length.error };
    data.length = length.value;
  }

  if (body.type !== undefined) {
    const type = readEnum<EmailType>(body, "type", TYPE_VALUES);
    if (!type.ok) return { valid: false, error: type.error };
    data.type = type.value;
  }

  const favorite = readOptionalBoolean(body, "favorite");
  if (!favorite.ok) return { valid: false, error: favorite.error };
  if (favorite.value !== undefined) data.favorite = favorite.value;

  if (Object.keys(data).length === 0) {
    return { valid: false, error: "Provide at least one field to update." };
  }

  return { valid: true, data };
}
