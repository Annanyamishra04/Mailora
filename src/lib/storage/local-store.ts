import type { NewSavedEmail, SavedEmail } from "@/lib/types";
import { EMAILS_CHANGED_EVENT, type EmailStore } from "./types";

/**
 * LOCAL STORAGE STORE.
 *
 * The original Phase 1 persistence backend. As of Phase 4, every
 * authenticated route is protected (see `src/proxy.ts`), so in
 * practice this store is only reachable if a page renders briefly before
 * auth state resolves, or from `lib/storage/index.ts` when there's no
 * authenticated session. It's kept — rather than deleted — for that edge
 * case and to avoid a hard dependency on Supabase for local development
 * without a project configured.
 *
 * This is the single place that knows the localStorage key and shape.
 * Nothing else in the app should reach into it directly — everything
 * goes through `lib/storage/index.ts`.
 */

const STORAGE_KEY = "ai-mail-studio:emails";

function isBrowser() {
  return typeof window !== "undefined";
}

function generateId(): string {
  if (isBrowser() && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `email_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(): SavedEmail[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedEmail[];
  } catch {
    return [];
  }
}

function writeAll(emails: SavedEmail[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
    window.dispatchEvent(new Event(EMAILS_CHANGED_EVENT));
  } catch {
    // Storage can fail (quota exceeded, private browsing, etc.). Callers
    // surface this to the user via a toast rather than silently dropping it.
    throw new Error("Couldn't save to this browser's storage.");
  }
}

function getEmailsSync(): SavedEmail[] {
  return [...readAll()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function getEmailSync(id: string): SavedEmail | undefined {
  return readAll().find((email) => email.id === id);
}

async function getEmails(): Promise<SavedEmail[]> {
  return getEmailsSync();
}

async function getEmail(id: string): Promise<SavedEmail | undefined> {
  return getEmailSync(id);
}

async function saveEmail(input: NewSavedEmail): Promise<SavedEmail> {
  const now = new Date().toISOString();
  const email: SavedEmail = {
    ...input,
    id: generateId(),
    type: input.type ?? "generated",
    favorite: input.favorite ?? false,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([email, ...readAll()]);
  return email;
}

async function updateEmail(
  id: string,
  patch: Partial<NewSavedEmail>,
): Promise<SavedEmail | undefined> {
  const emails = readAll();
  const index = emails.findIndex((email) => email.id === id);
  if (index === -1) return undefined;

  const updated: SavedEmail = {
    ...emails[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  emails[index] = updated;
  writeAll(emails);
  return updated;
}

async function deleteEmail(id: string): Promise<void> {
  writeAll(readAll().filter((email) => email.id !== id));
}

export const localEmailStore: EmailStore = {
  getEmails,
  getEmail,
  saveEmail,
  updateEmail,
  deleteEmail,
};
