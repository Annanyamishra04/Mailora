import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service-role key. This bypasses Row
 * Level Security entirely, so it must never be imported into anything
 * that runs in the browser (the `server-only` import above makes that a
 * build error) and never used to satisfy a client-supplied `user_id`.
 *
 * None of Phase 4's routes need this — every operation is scoped to the
 * authenticated user via the session-aware client in `lib/supabase/server.ts`
 * plus RLS policies, which is the safer default. This is scaffolding for a
 * genuinely privileged, server-initiated task in a later phase (e.g. an
 * admin tool or a cross-user migration job), not for normal request
 * handling.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Admin Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
