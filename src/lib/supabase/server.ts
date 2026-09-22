import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./errors";

/**
 * Server Supabase client — for use in Server Components, Route Handlers,
 * and Server Actions only. Reads/writes the session through Next's cookie
 * store, matching the same cookie format the browser client and middleware
 * use, so a session established client-side is immediately visible here.
 *
 * This client is scoped to the signed-in user (anon key + their session
 * cookie) and is subject to Row Level Security — it is NOT the privileged
 * client. See `lib/supabase/admin.ts` for the service-role client, which
 * this app does not use for normal request handling.
 *
 * Throws `SupabaseConfigError` if Supabase env vars are missing.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` is called from a Server Component, where cookies can't
          // be written. Safe to ignore here because middleware refreshes
          // the session on every request.
        }
      },
    },
  });
}
