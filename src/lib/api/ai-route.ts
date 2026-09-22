import "server-only";
import { toApiError } from "@/lib/ai/errors";
import { BODY_LIMITS, readJsonBody } from "@/lib/http";
import type { ValidationResult } from "@/lib/validation/common";
import { withAuth } from "./guard";
import { describeError, jsonError, jsonOk } from "./response";

/**
 * Builds the POST handler for one `/api/ai/*` endpoint.
 *
 * Pipeline: authenticate + rate limit (`withAuth`) → bounded JSON read →
 * strict validation → provider call → normalized errors. Gemini is never
 * reached for an unauthenticated, rate-limited, oversized, or invalid
 * request. Successful responses are exactly what the AI service returned,
 * so the browser contract is unchanged from earlier phases.
 */
export function createAiRoute<TInput, TResult>(options: {
  tag: string;
  validate: (body: unknown) => ValidationResult<TInput>;
  run: (input: TInput) => Promise<TResult>;
}) {
  return withAuth({ tag: options.tag, limit: "ai" }, async ({ req }) => {
    const body = await readJsonBody(req, { maxBytes: BODY_LIMITS.ai });
    if (!body.ok) return jsonError(body.status, body.error, { code: body.code });

    const validation = options.validate(body.data);
    if (!validation.valid) {
      return jsonError(400, validation.error, { code: "invalid_request" });
    }

    try {
      return jsonOk(await options.run(validation.data));
    } catch (error) {
      const failure = toApiError(error);
      // Log server-side only, and only what's needed to debug: the request
      // text and the model's raw output can contain private email content.
      console.error(`[${options.tag}] ${failure.code} (${failure.status}): ${describeError(error)}`);
      if (error instanceof Error && error.cause !== undefined) {
        console.error(`[${options.tag}] cause: ${describeError(error.cause)}`);
      }
      return jsonError(failure.status, failure.message, {
        code: failure.code,
        headers: failure.retryAfterSeconds
          ? { "Retry-After": String(failure.retryAfterSeconds) }
          : undefined,
      });
    }
  });
}
