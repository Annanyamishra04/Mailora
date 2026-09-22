import type { NewSavedEmail, SavedEmail } from "@/lib/types";

/**
 * Common shape a persistence backend must implement.
 *
 * `local-store.ts` implements this against `localStorage` (used for the
 * unauthenticated edge case); `supabase-store.ts` implements it against
 * the `/api/emails` routes, which are themselves backed by Supabase
 * Postgres with Row Level Security. Callers only ever go through
 * `lib/storage/index.ts` (in practice, through the `useEmails` hook).
 *
 * Every method is async — the local implementation resolves immediately,
 * the Supabase implementation makes a network request — so callers don't
 * need to know which backend is active.
 */
export interface EmailStore {
  getEmails(): Promise<SavedEmail[]>;
  getEmail(id: string): Promise<SavedEmail | undefined>;
  saveEmail(input: NewSavedEmail): Promise<SavedEmail>;
  updateEmail(id: string, patch: Partial<NewSavedEmail>): Promise<SavedEmail | undefined>;
  deleteEmail(id: string): Promise<void>;
}

export const EMAILS_CHANGED_EVENT = "ai-mail-studio:emails-changed";
