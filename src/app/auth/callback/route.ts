import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/routes";

/**
 * GET /auth/callback — where the email-confirmation link lands (see
 * `emailRedirectTo` in the signup page).
 *
 * Exchanges the one-time `code` for a session cookie so the person is
 * signed in straight after confirming, instead of being sent to log in
 * again. If the exchange fails for any reason — expired link, opened on a
 * different device from the one that signed up (the PKCE verifier lives in
 * that browser) — they are sent to /login with a plain-language notice; the
 * email is still confirmed, so logging in works.
 *
 * `next` is validated with `safeRedirectPath`, so this can't be turned
 * into an open redirect.
 *
 * Setup: add `<your-site>/auth/callback` to Supabase → Authentication →
 * URL Configuration → Redirect URLs. Until then Supabase falls back to the
 * Site URL and everything behaves as before.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next"));

  const headers = { "Cache-Control": "no-store" };

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url), { headers });
    } catch {
      // Fall through to the generic failure redirect below.
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", url), { headers });
}
