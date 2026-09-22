import { apiRequest } from "@/lib/api-client";
import type { NewSavedEmail, SavedEmail } from "@/lib/types";
import type { EmailStore } from "./types";

/**
 * SUPABASE-BACKED STORE.
 *
 * Talks only to this app's own `/api/emails` routes — never to Supabase
 * directly from the browser for writes — so the server can verify the
 * session and derive `user_id` itself. Those routes are backed by
 * Postgres with Row Level Security; this file just knows the HTTP shape.
 */

interface EmailsListResponse {
  emails: SavedEmail[];
}

interface EmailResponse {
  email: SavedEmail;
}

function request<T>(url: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(url, init);
}

async function getEmails(): Promise<SavedEmail[]> {
  const { emails } = await request<EmailsListResponse>("/api/emails", { method: "GET" });
  return emails;
}

async function getEmail(id: string): Promise<SavedEmail | undefined> {
  // No single-record GET route is needed today — every caller already has
  // the full list loaded (see `useEmails`). Falling back to a list scan
  // keeps this store's public shape symmetric with `EmailStore` without
  // adding an endpoint nothing currently calls.
  const emails = await getEmails();
  return emails.find((email) => email.id === id);
}

async function saveEmail(input: NewSavedEmail): Promise<SavedEmail> {
  const { email } = await request<EmailResponse>("/api/emails", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return email;
}

async function updateEmail(
  id: string,
  patch: Partial<NewSavedEmail>,
): Promise<SavedEmail | undefined> {
  const { email } = await request<EmailResponse>(`/api/emails/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return email;
}

async function deleteEmail(id: string): Promise<void> {
  await request<{ deleted: true }>(`/api/emails/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const supabaseEmailStore: EmailStore = {
  getEmails,
  getEmail,
  saveEmail,
  updateEmail,
  deleteEmail,
};
