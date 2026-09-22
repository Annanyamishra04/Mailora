import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthPage, isProtectedPath, safeRedirectPath } from "@/lib/routes";

/**
 * Runs on every request (except static assets, see `config.matcher`).
 *
 * Two jobs:
 * 1. Refresh the Supabase session cookie so server components and API
 *    routes always see an up-to-date session.
 * 2. Protect authenticated PAGES and bounce logged-in users away from the
 *    auth pages, so this is the single place page protection lives instead
 *    of being duplicated in every page.
 *
 * API routes are deliberately NOT redirected here: an unauthenticated
 * `/api/*` call must get a JSON 401 from the route itself (see
 * `lib/api/guard.ts`), not an HTML redirect to /login that `fetch` would
 * follow and try to parse as JSON.
 *
 * Public pages (landing, 404) skip the Supabase round trip entirely — they
 * neither need a session nor render one.
 */

function needsSession(pathname: string): boolean {
  return isProtectedPath(pathname) || isAuthPage(pathname) || pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  if (!needsSession(pathname)) return response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase isn't configured yet. Don't block navigation on it — the
  // affected pages (protected routes, login/signup) show their own
  // "not configured" state rather than the middleware pretending auth
  // works when it can't verify anything. API routes fail closed on their
  // own (503), and never reach the database or AI provider.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Re-validates the token against Supabase rather than trusting the
  // cookie's contents. If Supabase Auth itself is unreachable this fails
  // CLOSED (treated as signed out) instead of throwing a 500 for the whole
  // request.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error(
      "[proxy] session check failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown error",
    );
  }

  // A redirect is a brand-new response, so any session cookies that were
  // just refreshed above must be copied onto it — otherwise the browser
  // keeps the old, already-rotated refresh token and gets signed out.
  function redirect(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (isProtectedPath(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return redirect(url);
  }

  if (isAuthPage(pathname) && user) {
    // `safeRedirectPath` returns a path that may include a query string
    // (e.g. "/compose?id=…"). Assigning that to `url.pathname` would
    // percent-encode the "?", so resolve it to a URL and copy both parts.
    const target = new URL(
      safeRedirectPath(request.nextUrl.searchParams.get("redirectTo")),
      request.nextUrl,
    );
    const url = request.nextUrl.clone();
    url.pathname = target.pathname;
    url.search = target.search;
    url.hash = target.hash;
    return redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)",
  ],
};
