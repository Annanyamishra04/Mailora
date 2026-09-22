export type AiErrorCode =
  | "not_configured"
  | "invalid_request"
  | "rate_limited"
  | "provider_error"
  | "invalid_response"
  | "timeout"
  | "network_error";

/**
 * A deliberately generic error surface for anything that can go wrong
 * talking to an AI provider. `message` is always safe to show a user —
 * provider-specific details (status codes, raw bodies, variable names) are
 * kept out of it: they go in `cause` (logged server-side, never returned) or
 * `devHint` (appended to the response ONLY outside production, so a
 * developer running locally sees exactly what to fix while a deployed app
 * never discloses its configuration).
 */
export class AiError extends Error {
  code: AiErrorCode;
  status: number;
  /** Seconds the caller should wait before retrying, when the provider told us. */
  retryAfterSeconds?: number;
  devHint?: string;

  constructor(
    code: AiErrorCode,
    message: string,
    options?: {
      status?: number;
      cause?: unknown;
      retryAfterSeconds?: number;
      devHint?: string;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AiError";
    this.code = code;
    this.status = options?.status ?? codeToStatus(code);
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.devHint = options?.devHint;
  }
}

function codeToStatus(code: AiErrorCode): number {
  switch (code) {
    case "not_configured":
      return 503;
    case "invalid_request":
      return 400;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "network_error":
    case "provider_error":
    case "invalid_response":
    default:
      return 502;
  }
}

/** Machine-readable code sent to the browser alongside the message. */
function apiCodeFor(code: AiErrorCode): string {
  switch (code) {
    case "not_configured":
      return "not_configured";
    case "invalid_request":
      return "invalid_request";
    case "rate_limited":
      return "provider_rate_limited";
    case "timeout":
      return "timeout";
    default:
      return "ai_unavailable";
  }
}

export interface ApiFailure {
  status: number;
  message: string;
  code: string;
  retryAfterSeconds?: number;
}

/** Converts any thrown error into a safe `{ status, message, code }` for an API response. */
export function toApiError(error: unknown): ApiFailure {
  if (error instanceof AiError) {
    const showHint = process.env.NODE_ENV !== "production" && error.devHint;
    return {
      status: error.status,
      message: showHint ? `${error.message} (${error.devHint})` : error.message,
      code: apiCodeFor(error.code),
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  // Anything unexpected: never leak internals to the client.
  return {
    status: 500,
    message: "Something went wrong generating that. Please try again.",
    code: "server_error",
  };
}
