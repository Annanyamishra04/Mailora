/**
 * Route classification shared by `proxy.ts` (server) and the client auth
 * provider, so "which pages need a session" is defined in exactly one place.
 *
 * No imports on purpose: this module is safe to load from the proxy, from
 * client components, and from plain Node (unit tests).
 */

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/compose",
  "/reply",
  "/templates",
  "/history",
  "/settings",
] as const;

export const AUTH_PAGES = ["/login", "/signup"] as const;

export const DEFAULT_AUTHED_PATH = "/dashboard";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return (AUTH_PAGES as readonly string[]).includes(pathname);
}

const MAX_REDIRECT_LENGTH = 2048;

function hasControlOrBackslash(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    // C0 controls, DEL, and backslash. Browsers strip tabs/newlines from
    // URLs and treat "\" like "/", so "/\t/evil.com" or "/\evil.com" would
    // otherwise become the protocol-relative URL "//evil.com".
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/**
 * Validates a user-supplied post-login destination (`?redirectTo=`, `?next=`)
 * and returns a same-origin relative path, or `fallback`.
 *
 * Without this, `/login?redirectTo=https://evil.example` would send a freshly
 * authenticated user to an attacker's site (an open redirect, commonly used
 * for phishing). Only paths that begin with a single "/" and resolve to this
 * origin are accepted, and never the auth pages or API routes themselves
 * (redirecting there would loop or land on raw JSON).
 */
export function safeRedirectPath(
  input: string | null | undefined,
  fallback: string = DEFAULT_AUTHED_PATH,
): string {
  if (!input || input.length > MAX_REDIRECT_LENGTH) return fallback;
  if (!input.startsWith("/") || input.startsWith("//")) return fallback;
  if (hasControlOrBackslash(input)) return fallback;

  // Defense in depth: a percent-encoded "//" or "\" prefix ("/%2F%2Fevil.example",
  // "/%5Cevil.example") stays same-origin in browsers today, but some
  // servers and proxies decode before routing. Refuse anything that would
  // turn into a protocol-relative URL once decoded.
  try {
    const decoded = decodeURIComponent(input);
    if (decoded.startsWith("//") || hasControlOrBackslash(decoded)) return fallback;
  } catch {
    return fallback; // malformed percent-encoding
  }

  let url: URL;
  try {
    url = new URL(input, "http://redirect.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://redirect.invalid") return fallback;

  const { pathname } = url;
  if (isAuthPage(pathname) || pathname === "/api" || pathname.startsWith("/api/")) {
    return fallback;
  }

  return `${pathname}${url.search}${url.hash}`;
}
