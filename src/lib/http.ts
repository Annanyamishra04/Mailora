/**
 * Request-level helpers shared by every API route. No imports on purpose —
 * this only touches standard Web APIs (`Request`, streams, `TextDecoder`),
 * so it is safe anywhere and testable in plain Node.
 */

/**
 * Byte ceilings for request bodies, sized from the largest *valid* payload
 * each endpoint accepts (sum of its field limits × 4 bytes per UTF-8
 * character, plus JSON overhead). The per-field character limits in
 * `lib/validation/*` remain the real gatekeeper; these exist to refuse a
 * multi-megabyte body before it is buffered, parsed, or sent to an LLM.
 *
 * Measured in BYTES, not characters: a 20,000-character email written in
 * Devanagari or CJK is ~60 KB on the wire, and must not be rejected.
 */
export const BODY_LIMITS = {
  /** Largest AI payload: one 20,000-char field (+ small fields). */
  ai: 96 * 1024,
  /** Saved email: 30,000-char body + recipient/subject/purpose/instructions. */
  email: 160 * 1024,
  /** Saved template: 20,000-char body + name/description/subject. */
  template: 96 * 1024,
} as const;

export type ReadJsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; code: string };

function fail(status: number, error: string, code: string): ReadJsonBodyResult {
  return { ok: false, status, error, code };
}

/**
 * Reads and parses a JSON request body with a hard byte limit.
 *
 * - Requires `Content-Type: application/json` (415 otherwise). Besides
 *   being correct, this means a cross-site HTML form can't forge the request.
 * - Rejects on the declared `Content-Length` before reading anything.
 * - Streams the body and aborts the moment the limit is exceeded, so a
 *   client that lies about (or omits) `Content-Length` still can't make the
 *   server buffer an unbounded body.
 * - Decodes as strict UTF-8 and parses JSON, returning a clear 400 for empty,
 *   non-UTF-8, or malformed bodies.
 */
export async function readJsonBody(
  req: Request,
  { maxBytes }: { maxBytes: number },
): Promise<ReadJsonBodyResult> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(contentType.trim())) {
    return fail(415, "Content-Type must be application/json.", "unsupported_media_type");
  }

  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (Number.isFinite(length) && length > maxBytes) {
      return fail(413, "Request body is too large.", "payload_too_large");
    }
  }

  if (!req.body) {
    return fail(400, "Request body is empty.", "invalid_request");
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return fail(413, "Request body is too large.", "payload_too_large");
      }
      chunks.push(value);
    }
  } catch {
    return fail(400, "Couldn't read the request body.", "invalid_request");
  }

  if (received === 0) {
    return fail(400, "Request body is empty.", "invalid_request");
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(merged);
  } catch {
    return fail(400, "Request body must be valid UTF-8 text.", "invalid_request");
  }

  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return fail(400, "Request body must be valid JSON.", "invalid_request");
  }
}

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * Best-effort client IP for rate limiting.
 *
 * On Vercel, `x-vercel-forwarded-for` / `x-forwarded-for` are set by the
 * platform edge and cannot be spoofed by the client. When self-hosting
 * behind your own proxy, make sure that proxy overwrites these headers —
 * otherwise a client can pick its own "IP" and dodge the per-IP limiter
 * (the per-user limiter is unaffected).
 */
export function getClientIp(req: Request): string {
  const raw =
    req.headers.get("x-vercel-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for") ??
    "";
  const first = raw.split(",")[0]?.trim() ?? "";
  return IP_PATTERN.test(first) ? first : "unknown";
}

/**
 * CSRF defense-in-depth for state-changing requests: true if the browser
 * says this request was initiated from another site.
 *
 * Session cookies are already `SameSite=Lax`, and `readJsonBody` refuses
 * non-JSON bodies (a cross-site form can't send those without a CORS
 * preflight, which this app never approves) — this check is a third,
 * independent layer. Requests with neither header (curl, server-to-server)
 * are not browser-originated CSRF and are allowed through; they still
 * need a valid session.
 */
export function isCrossSiteRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (origin === "null") return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = forwardedHost || req.headers.get("host") || new URL(req.url).host;
  return originHost !== expectedHost;
}
