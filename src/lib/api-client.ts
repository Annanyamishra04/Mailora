/**
 * Browser-side fetch wrapper used by every call to this app's own API
 * (`ai-client.ts`, `storage/supabase-*.ts`). One place decides how failures
 * look to the UI:
 *
 *  - network failure / timeout → a plain-language message, `status` 0
 *  - 401 → also announces "session expired" (see below) so the app can tell
 *    the user to log in again instead of every caller inventing its own handling
 *  - 429 → the server's "wait N seconds" message, plus `retryAfterSeconds`
 *  - anything else → the server's `error` string, or a generic fallback
 *
 * Callers just `catch (e)` and show `e.message`; `e` is always an
 * `ApiRequestError` whose message is safe to display.
 */

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(message: string, options: { status: number; code?: string; retryAfterSeconds?: number }) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export const SESSION_EXPIRED_EVENT = "ai-mail-studio:session-expired";

let intentionalSignOut = false;

/** Call right before a user-initiated sign-out so it isn't reported as an expired session. */
export function markIntentionalSignOut(): void {
  intentionalSignOut = true;
}

/** Call once a user is signed in again, so later session losses are reported. */
export function resetIntentionalSignOut(): void {
  intentionalSignOut = false;
}

export function wasIntentionalSignOut(): boolean {
  return intentionalSignOut;
}

export function notifySessionExpired(): void {
  if (typeof window === "undefined" || intentionalSignOut) return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

const DEFAULT_TIMEOUT_MS = 45_000;
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export interface ApiRequestInit extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
}

function readErrorBody(data: unknown): { message?: string; code?: string } {
  if (!data || typeof data !== "object") return {};
  const record = data as { error?: unknown; code?: unknown };
  return {
    message: typeof record.error === "string" ? record.error : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
}

export async function apiRequest<T>(url: string, init: ApiRequestInit = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("That took too long. Please try again.", { status: 0, code: "timeout" });
    }
    throw new ApiRequestError("Couldn't reach the server. Check your connection and try again.", {
      status: 0,
      code: "network_error",
    });
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON body: handled by the generic messages below.
  }

  if (!response.ok) {
    const { message, code } = readErrorBody(data);
    const retryHeader = Number(response.headers.get("retry-after"));
    const retryAfterSeconds = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined;

    if (response.status === 401) {
      notifySessionExpired();
      throw new ApiRequestError("Your session has expired. Please log in again.", {
        status: 401,
        code: code ?? "unauthenticated",
      });
    }

    if (response.status === 429) {
      throw new ApiRequestError(
        message ?? "You're doing that too quickly. Please wait a moment and try again.",
        { status: 429, code: code ?? "rate_limited", retryAfterSeconds },
      );
    }

    throw new ApiRequestError(message ?? GENERIC_MESSAGE, { status: response.status, code, retryAfterSeconds });
  }

  if (data === null) {
    throw new ApiRequestError(GENERIC_MESSAGE, { status: response.status, code: "invalid_response" });
  }

  return data as T;
}
