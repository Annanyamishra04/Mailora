/**
 * Thrown when Supabase environment variables are missing. This is a
 * deliberately distinct error type so callers (API routes, auth forms) can
 * show a clear "this deployment isn't configured yet" message instead of a
 * generic failure — and, per Phase 4's "no fake data" rule, so the app
 * never pretends an auth or database operation succeeded when Supabase
 * isn't actually reachable.
 */
export class SupabaseConfigError extends Error {
  constructor() {
    super(
      "Supabase isn't configured for this deployment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    this.name = "SupabaseConfigError";
  }
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new SupabaseConfigError();
  }
  return { url, anonKey };
}
