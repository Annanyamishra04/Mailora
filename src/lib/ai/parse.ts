import { AiError } from "./errors";
import type {
  ActionItem,
  ActionItemsResult,
  GenerateEmailResult,
  GenerateReplyResult,
  GenerateSubjectResult,
  RewriteEmailResult,
  SummarizeEmailResult,
} from "./types";

/**
 * Providers are asked to return JSON, but nothing from an external API
 * should ever be trusted blindly. These helpers strip incidental markdown
 * fencing some models still add, parse the JSON defensively, and validate
 * the resulting shape before it reaches the rest of the app.
 */

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Model output is untrusted text. Two things are enforced here on every
 * string before it can reach the UI or a database write:
 *  - characters Postgres can't store (NUL, lone surrogates) are removed, so
 *    an odd completion can't make a later "Save" fail with a 500;
 *  - a hard length cap, matching the limits `lib/validation/emails.ts`
 *    applies when the user saves the result.
 * The UI renders all of it as plain text (React text nodes / textarea
 * values) — never as HTML.
 */
const OUTPUT_LIMITS = {
  subject: 500,
  body: 30_000,
  short: 1_000,
  keyPoints: 25,
  items: 50,
} as const;

function cleanText(value: string, maxLength: number): string {
  let text = value.replace(/\u0000/g, "");
  const toWellFormed = (text as { toWellFormed?: () => string }).toWellFormed;
  if (typeof toWellFormed === "function") text = toWellFormed.call(text);
  text = text.trim();
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
}

/**
 * Parses provider output into a plain object. Failure details deliberately
 * exclude the raw text: it is derived from the user's private email content
 * and must not end up in server logs.
 */
function parseJson(text: string): Record<string, unknown> {
  const cleaned = stripCodeFences(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Deliberately NOT including the SyntaxError's message: V8 embeds the
    // first characters of the input in it ("Unexpected token 'P',
    // \"PRIVATE_EM\"... is not valid JSON"), which would put a snippet of
    // the user's email content in the server logs.
    throw new AiError(
      "invalid_response",
      "The AI provider returned a response we couldn't understand. Please try again.",
      { cause: `JSON parse failed (${cleaned.length} characters of output)` },
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AiError(
      "invalid_response",
      "The AI provider returned a response we couldn't understand. Please try again.",
      { cause: `Expected a JSON object, received ${Array.isArray(parsed) ? "an array" : typeof parsed}` },
    );
  }
  return parsed as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function malformed(what: string, message = "The AI provider's response was malformed. Please try again."): AiError {
  return new AiError("invalid_response", message, { cause: `Malformed ${what} response` });
}

export function parseGenerateEmailResponse(raw: string): GenerateEmailResult {
  const data = parseJson(raw);
  if (!isNonEmptyString(data.subject) || !isNonEmptyString(data.body)) {
    throw malformed(
      "generate-email",
      "The AI provider's response was missing a subject or body. Please try again.",
    );
  }
  return {
    subject: cleanText(data.subject, OUTPUT_LIMITS.subject),
    body: cleanText(data.body, OUTPUT_LIMITS.body),
  };
}

export function parseGenerateReplyResponse(raw: string): GenerateReplyResult {
  const data = parseJson(raw);
  if (!isNonEmptyString(data.subject) || !isNonEmptyString(data.body)) {
    throw malformed(
      "generate-reply",
      "The AI provider's response was missing a subject or body. Please try again.",
    );
  }
  return {
    subject: cleanText(data.subject, OUTPUT_LIMITS.subject),
    body: cleanText(data.body, OUTPUT_LIMITS.body),
  };
}

export function parseRewriteResponse(raw: string): RewriteEmailResult {
  const data = parseJson(raw);
  if (!isNonEmptyString(data.body)) {
    throw malformed(
      "rewrite",
      "The AI provider's response was missing the rewritten text. Please try again.",
    );
  }
  return { body: cleanText(data.body, OUTPUT_LIMITS.body) };
}

export function parseGenerateSubjectResponse(raw: string): GenerateSubjectResult {
  const data = parseJson(raw);
  if (!isNonEmptyString(data.subject)) {
    throw malformed(
      "subject",
      "The AI provider's response was missing a subject. Please try again.",
    );
  }
  return { subject: cleanText(data.subject, OUTPUT_LIMITS.subject) };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.trim().length > 0);
}

function normalizeNullableString(value: unknown, maxLength: number): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return cleanText(value, maxLength) || null;
  }
  return null;
}

export function parseSummarizeResponse(raw: string): SummarizeEmailResult {
  const data = parseJson(raw);

  if (!isNonEmptyString(data.purpose)) {
    throw malformed(
      "summarize",
      "The AI provider's response was missing a summary. Please try again.",
    );
  }

  if (!Array.isArray(data.keyPoints) || !data.keyPoints.every((p) => typeof p === "string")) {
    throw malformed("summarize (keyPoints)");
  }

  if (!isNullableString(data.requestedAction) || !isNullableString(data.deadline)) {
    throw malformed("summarize (fields)");
  }

  return {
    purpose: cleanText(data.purpose, OUTPUT_LIMITS.short),
    keyPoints: (data.keyPoints as string[])
      .slice(0, OUTPUT_LIMITS.keyPoints)
      .map((p) => cleanText(p, OUTPUT_LIMITS.short))
      .filter(Boolean),
    requestedAction: normalizeNullableString(data.requestedAction, OUTPUT_LIMITS.short),
    deadline: normalizeNullableString(data.deadline, OUTPUT_LIMITS.short),
  };
}

export function parseActionItemsResponse(raw: string): ActionItemsResult {
  const data = parseJson(raw);

  if (!Array.isArray(data.items)) {
    throw malformed("action-items");
  }

  const items: ActionItem[] = [];
  for (const entry of data.items.slice(0, OUTPUT_LIMITS.items)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw malformed("action-items (non-object item)");
    }
    const item = entry as Record<string, unknown>;
    if (!isNonEmptyString(item.task)) {
      throw malformed("action-items (missing task)");
    }
    if (!isNullableString(item.owner) || !isNullableString(item.deadline)) {
      throw malformed("action-items (owner/deadline)");
    }
    items.push({
      task: cleanText(item.task, OUTPUT_LIMITS.short),
      owner: normalizeNullableString(item.owner, OUTPUT_LIMITS.short),
      deadline: normalizeNullableString(item.deadline, OUTPUT_LIMITS.short),
    });
  }

  return { items };
}
