import { localEmailStore } from "./local-store";
import { supabaseEmailStore } from "./supabase-store";
import { localTemplateStore } from "./local-template-store";
import { supabaseTemplateStore } from "./supabase-template-store";
import type { EmailStore } from "./types";
import { ApiRequestError } from "@/lib/api-client";
import type { TemplateStore } from "./template-types";

/**
 * Public storage service.
 *
 * Which backend is "active" depends on authentication state, which this
 * module itself has no way to know (it's imported from both client and
 * server contexts). Callers — in practice just the `useEmails` hook —
 * decide per-call via `getEmailStore(isAuthenticated)`:
 *
 *   - authenticated  → Supabase, through `/api/emails` (RLS-enforced, the
 *     source of truth for real accounts)
 *   - unauthenticated → localStorage (Phase 1 behavior, kept for the case
 *     where a page briefly renders before auth state resolves, or for
 *     local development without Supabase configured)
 *
 * This avoids two stores racing to be "the" source of truth: only one is
 * ever read from or written to for a given render.
 */
export function getEmailStore(isAuthenticated: boolean): EmailStore {
  return isAuthenticated ? supabaseEmailStore : localEmailStore;
}

function sessionExpired(): Promise<never> {
  return Promise.reject(
    new ApiRequestError("Your session has expired. Log in again to keep working.", {
      status: 401,
      code: "unauthenticated",
    }),
  );
}

/**
 * Used when Supabase IS configured but there is no signed-in user (a
 * session that expired or was ended in another tab while a page was open).
 * Falling back to localStorage there would be a trap: the UI would say
 * "Draft saved" for data that only exists in this browser and never
 * reaches the account. Every operation fails loudly instead.
 */
export const signedOutEmailStore: EmailStore = {
  getEmails: sessionExpired,
  getEmail: sessionExpired,
  saveEmail: sessionExpired,
  updateEmail: sessionExpired,
  deleteEmail: sessionExpired,
};

export const signedOutTemplateStore: TemplateStore = {
  getTemplates: sessionExpired,
  saveTemplate: sessionExpired,
  updateTemplate: sessionExpired,
  deleteTemplate: sessionExpired,
};

/**
 * Same pattern as `getEmailStore`, for user-owned (custom) templates.
 * Built-in templates never go through this — see `lib/templates/builtin.ts`.
 */
export function getTemplateStore(isAuthenticated: boolean): TemplateStore {
  return isAuthenticated ? supabaseTemplateStore : localTemplateStore;
}

export { EMAILS_CHANGED_EVENT } from "./types";
export type { EmailStore } from "./types";
export { TEMPLATES_CHANGED_EVENT } from "./template-types";
export type { TemplateStore } from "./template-types";
