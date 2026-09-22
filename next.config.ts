import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * Applied to every route. The Content-Security-Policy is production-only:
 * `next dev` needs `unsafe-eval` and inline HMR scripts, and a CSP that is
 * loose enough for development while strict enough to matter is not worth
 * the confusion — so development is unrestricted and production is
 * enforced.
 *
 * Why the CSP still allows inline scripts/styles: Next.js's App Router
 * hydrates from inline <script> tags, `next-themes` sets the theme with an
 * inline script before first paint, and Radix UI positions popovers with
 * inline styles. A nonce-based CSP would remove `unsafe-inline` but forces
 * every page to render dynamically (a nonce must differ per request), which
 * costs static rendering for the marketing page and adds real complexity.
 * The policy below still delivers the important protections: no plugins
 * (`object-src 'none'`), no framing (`frame-ancestors 'none'`), no
 * base-tag or form hijacking, and — critically — `connect-src` limited to
 * this origin and the configured Supabase project, so injected script could
 * not exfiltrate data to an arbitrary host. Gemini is only ever called
 * server-side, so it deliberately does not appear in `connect-src`.
 */

const isProduction = process.env.NODE_ENV === "production";

function supabaseOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const url = new URL(raw);
      const wsProtocol = url.protocol === "http:" ? "ws:" : "wss:";
      return [url.origin, `${wsProtocol}//${url.host}`];
    } catch {
      // Fall through to the wildcard below.
    }
  }
  // Env not present at build time: allow any Supabase project rather than
  // shipping a policy that blocks sign-in outright.
  return ["https://*.supabase.co", "wss://*.supabase.co"];
}

function contentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigins().join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join("; ");
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Content-Security-Policy", value: contentSecurityPolicy() },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses carry per-user data; never let a browser/CDN cache them.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
