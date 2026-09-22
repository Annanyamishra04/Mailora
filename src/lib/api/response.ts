import { NextResponse } from "next/server";

/**
 * One response shape for every API route: errors are always
 * `{ error: string, code: string }` (the `error` field is what the browser
 * clients already read — unchanged from earlier phases), and every API
 * response is `Cache-Control: no-store` so per-user data is never cached by
 * a browser, proxy, or CDN.
 */

export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "not_found"
  | "payload_too_large"
  | "unsupported_media_type"
  | "rate_limited"
  | "provider_rate_limited"
  | "not_configured"
  | "auth_unavailable"
  | "ai_unavailable"
  | "timeout"
  | "server_error";

const BASE_HEADERS = { "Cache-Control": "no-store" } as const;

export function jsonOk<T>(data: T, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { status, headers: { ...BASE_HEADERS, ...headers } });
}

export function jsonError(
  status: number,
  message: string,
  options: { code?: ApiErrorCode | string; headers?: Record<string, string> } = {},
): NextResponse {
  return NextResponse.json(
    { error: message, code: options.code ?? defaultCode(status) },
    { status, headers: { ...BASE_HEADERS, ...options.headers } },
  );
}

function defaultCode(status: number): ApiErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 413) return "payload_too_large";
  if (status === 415) return "unsupported_media_type";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

/**
 * Log-safe description of an unknown thrown value. Never includes a stack.
 *
 * Supabase/PostgREST errors are plain objects (`{ code, message, details,
 * hint }`), not `Error` instances — `String()` on one yields the useless
 * "[object Object]". Only `code` and `message` are logged: `details` can
 * echo row values (e.g. "Key (user_id)=(…) already exists"), which may be
 * personal data.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 500);
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    const parts = [
      typeof code === "string" ? `code=${code}` : "",
      typeof message === "string" ? message : "",
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ").slice(0, 500) : "non-Error object thrown";
  }
  return String(error).slice(0, 500);
}
