/**
 * Validation primitives shared by every server-side request validator
 * (`ai.ts`, `emails.ts`, `templates.ts`). Nothing here imports anything, so
 * the same rules are applied identically everywhere and can be unit tested
 * in isolation.
 */

export type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for a canonical UUID string. Row ids are Postgres `uuid` columns —
 * querying one with anything else makes Postgres raise a syntax error, which
 * would otherwise surface as a 500 instead of a clean 400/404.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Returns the first key of `data` that isn't in `allowed`, or null. */
export function findUnknownKey(
  data: Record<string, unknown>,
  allowed: readonly string[],
): string | null {
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) return key;
  }
  return null;
}

export function rejectUnknownKeys(
  data: Record<string, unknown>,
  allowed: readonly string[],
): string | null {
  const unknown = findUnknownKey(data, allowed);
  if (unknown === null) return null;
  // Truncate: the key is attacker-controlled and echoed back in the message.
  return `Unexpected field "${unknown.slice(0, 40)}".`;
}

/**
 * Text that Postgres (or the JSON pipeline in front of it) cannot store:
 * NUL bytes raise "unsupported Unicode escape sequence" and lone surrogates
 * are invalid UTF-16. Left unchecked these turn a bad request into a 500.
 */
export function hasUnstorableCharacters(value: string): boolean {
  if (value.includes("\u0000")) return true;
  const wellFormed = (value as { isWellFormed?: () => boolean }).isWellFormed;
  return typeof wellFormed === "function" && !wellFormed.call(value);
}

export interface ReadStringOptions {
  required: boolean;
  maxLength: number;
  /**
   * When true the value is trimmed before its length is measured and the
   * trimmed value is returned (AI inputs). When false the raw value is
   * measured and returned untouched (saved emails/templates keep the user's
   * exact whitespace). A `required` field must contain non-whitespace either way.
   */
  trim?: boolean;
}

export function readString(
  data: Record<string, unknown>,
  field: string,
  { required, maxLength, trim = false }: ReadStringOptions,
): FieldResult<string> {
  const raw = data[field];

  if (raw === undefined || raw === null || raw === "") {
    if (required) return { ok: false, error: `"${field}" is required.` };
    return { ok: true, value: "" };
  }

  if (typeof raw !== "string") {
    return { ok: false, error: `"${field}" must be a string.` };
  }

  if (hasUnstorableCharacters(raw)) {
    return { ok: false, error: `"${field}" contains invalid characters.` };
  }

  const trimmed = raw.trim();
  if (required && trimmed.length === 0) {
    return { ok: false, error: `"${field}" is required.` };
  }

  const value = trim ? trimmed : raw;
  if (value.length > maxLength) {
    return { ok: false, error: `"${field}" is too long (max ${maxLength} characters).` };
  }

  return { ok: true, value };
}

export function readOptionalBoolean(
  data: Record<string, unknown>,
  field: string,
): FieldResult<boolean | undefined> {
  const raw = data[field];
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== "boolean") {
    return { ok: false, error: `"${field}" must be a boolean.` };
  }
  return { ok: true, value: raw };
}

export function readEnum<T extends string>(
  data: Record<string, unknown>,
  field: string,
  allowed: ReadonlySet<string>,
): FieldResult<T> {
  const raw = data[field];
  if (typeof raw !== "string" || !allowed.has(raw)) {
    return { ok: false, error: `"${field}" must be one of: ${[...allowed].join(", ")}.` };
  }
  return { ok: true, value: raw as T };
}
