import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./server";

export interface AuthenticatedContext {
  user: User;
  /** Session-scoped client: subject to Row Level Security as this user. */
  supabase: SupabaseClient;
}

/**
 * Verifies the current request's session and returns the authenticated
 * user together with the session-scoped Supabase client, or `null` if
 * there isn't a valid session. Every server-side operation derives
 * ownership from this — never from a client-supplied `user_id`.
 *
 * Uses `auth.getUser()` (not `getSession()`), which re-validates the token
 * against Supabase Auth rather than trusting the cookie's contents.
 *
 * Throws `SupabaseConfigError` if Supabase isn't configured, and rethrows
 * unexpected failures so callers can distinguish "not signed in" (null)
 * from "couldn't check" (throw).
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  // supabase-js RETURNS (rather than throws) network failures and 5xx
  // responses from Supabase Auth. Those mean "couldn't check", not "signed
  // out": treating them as null would answer 401 during an outage, and the
  // browser would tell the user their session ended when it hadn't.
  if (error) {
    const status = (error as { status?: number }).status;
    if (error.name === "AuthRetryableFetchError" || (typeof status === "number" && status >= 500)) {
      throw error;
    }
    return null; // missing/invalid/expired session
  }

  if (!data.user) return null;
  return { user: data.user, supabase };
}

/** Convenience wrapper for callers that only need the user. */
export async function getAuthenticatedUser(): Promise<User | null> {
  const context = await getAuthenticatedContext();
  return context?.user ?? null;
}
