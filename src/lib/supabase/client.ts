import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./errors";

/**
 * Browser Supabase client — safe to import from client components. Session
 * storage is cookie-backed (via @supabase/ssr) so the server, middleware,
 * and browser all agree on the same session.
 *
 * Throws `SupabaseConfigError` if the required `NEXT_PUBLIC_*` variables
 * aren't set; callers should catch this and show a setup message rather
 * than letting auth calls silently no-op.
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
