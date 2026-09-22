import {
  TEMPLATE_CATEGORIES,
  type NewEmailTemplate,
  type TemplateCategory,
} from "@/lib/types";
import { isRecord, readEnum, readString, rejectUnknownKeys, type ValidationResult } from "./common";

/**
 * Server-side validation for the template persistence API. Mirrors the
 * style of `lib/validation/emails.ts`: every field is re-checked here
 * regardless of what the client sent, and a client-supplied `user_id` (or
 * `id`, `isBuiltin`, `createdAt`, `updatedAt`) is never read from the body.
 *
 * Phase 6: unknown fields (including `user_id` / `isBuiltin`) are rejected.
 */

export type { ValidationResult };

export const TEMPLATE_LIMITS = {
  name: 150,
  description: 300,
  subject: 300,
  body: 20_000,
} as const;

const CATEGORY_VALUES = new Set<string>(TEMPLATE_CATEGORIES.map((c) => c.value));

const WRITABLE_FIELDS = ["name", "description", "subject", "body", "category"] as const;

const NOT_AN_OBJECT = "Request body must be a JSON object.";

/** Validates the body of `POST /api/templates` (creating a custom template). */
export function validateCreateTemplateRequest(
  body: unknown,
): ValidationResult<NewEmailTemplate> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, WRITABLE_FIELDS);
  if (unknownKey) return { valid: false, error: unknownKey };

  const name = readString(body, "name", { required: true, maxLength: TEMPLATE_LIMITS.name });
  if (!name.ok) return { valid: false, error: name.error };

  const description = readString(body, "description", {
    required: false,
    maxLength: TEMPLATE_LIMITS.description,
  });
  if (!description.ok) return { valid: false, error: description.error };

  const subject = readString(body, "subject", { required: false, maxLength: TEMPLATE_LIMITS.subject });
  if (!subject.ok) return { valid: false, error: subject.error };

  const bodyText = readString(body, "body", { required: false, maxLength: TEMPLATE_LIMITS.body });
  if (!bodyText.ok) return { valid: false, error: bodyText.error };

  let category: TemplateCategory = "other";
  if (body.category !== undefined) {
    const parsed = readEnum<TemplateCategory>(body, "category", CATEGORY_VALUES);
    if (!parsed.ok) return { valid: false, error: parsed.error };
    category = parsed.value;
  }

  return {
    valid: true,
    data: {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      subject: subject.value,
      body: bodyText.value,
      category,
    },
  };
}

/** Validates the body of `PATCH /api/templates/[id]` (partial update). */
export function validateUpdateTemplateRequest(
  body: unknown,
): ValidationResult<Partial<NewEmailTemplate>> {
  if (!isRecord(body)) return { valid: false, error: NOT_AN_OBJECT };

  const unknownKey = rejectUnknownKeys(body, WRITABLE_FIELDS);
  if (unknownKey) return { valid: false, error: unknownKey };

  const data: Partial<NewEmailTemplate> = {};

  if (body.name !== undefined) {
    const name = readString(body, "name", { required: true, maxLength: TEMPLATE_LIMITS.name });
    if (!name.ok) return { valid: false, error: name.error };
    data.name = name.value.trim();
  }

  if (body.description !== undefined) {
    const description = readString(body, "description", {
      required: false,
      maxLength: TEMPLATE_LIMITS.description,
    });
    if (!description.ok) return { valid: false, error: description.error };
    data.description = description.value.trim() || undefined;
  }

  if (body.subject !== undefined) {
    const subject = readString(body, "subject", { required: false, maxLength: TEMPLATE_LIMITS.subject });
    if (!subject.ok) return { valid: false, error: subject.error };
    data.subject = subject.value;
  }

  if (body.body !== undefined) {
    const bodyText = readString(body, "body", { required: false, maxLength: TEMPLATE_LIMITS.body });
    if (!bodyText.ok) return { valid: false, error: bodyText.error };
    data.body = bodyText.value;
  }

  if (body.category !== undefined) {
    const category = readEnum<TemplateCategory>(body, "category", CATEGORY_VALUES);
    if (!category.ok) return { valid: false, error: category.error };
    data.category = category.value;
  }

  if (Object.keys(data).length === 0) {
    return { valid: false, error: "Provide at least one field to update." };
  }

  return { valid: true, data };
}
