import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthenticatedContext } from "@/lib/supabase/auth";
import { SupabaseConfigError } from "@/lib/supabase/errors";
import { getClientIp, isCrossSiteRequest } from "@/lib/http";
import type { RateLimitResult } from "@/lib/rate-limit";
import { getLimiter } from "./limits";
import { describeError, jsonError } from "./response";

/**
 * The single entry point every authenticated API route goes through.
 *
 * Wrapping a handler in `withAuth` guarantees, in this order, before the
 * handler (and therefore before any database or AI provider call) runs:
 *
 *   1. per-IP flood limit          (cheap, no network I/O)
 *   2. CSRF check for state-changing methods
 *   3. a valid Supabase session    → 401 otherwise, JSON, never a redirect
 *   4. per-user rate limit         → 429 + Retry-After
 *
 * and after it: any unexpected exception becomes a generic 500 that leaks
 * nothing. Because enforcement lives here rather than being copy-pasted
 * into each route, a new route can't "forget" authentication — it either
 * uses `withAuth` or is visibly unprotected in review.
 *
 * `user` comes from the verified session only. Handlers must never read a
 * user id from the request.
 */

export type LimitKind = "ai" | "write" | "none";

export interface AuthedRequest<P> {
  req: Request;
  params: P;
  user: User;
  supabase: SupabaseClient;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tooManyRequests(result: RateLimitResult, scope: "user" | "ip") {
  const wait = result.retryAfterSeconds;
  const message =
    scope === "ip"
      ? `Too many requests from your network. Please wait ${wait} second${wait === 1 ? "" : "s"} and try again.`
      : `You're doing that too quickly. Please wait ${wait} second${wait === 1 ? "" : "s"} and try again.`;
  return jsonError(429, message, {
    code: "rate_limited",
    headers: {
      "Retry-After": String(wait),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": "0",
    },
  });
}

export function withAuth<P = Record<string, never>>(
  config: { tag: string; limit: LimitKind },
  handler: (args: AuthedRequest<P>) => Promise<Response>,
) {
  return async function routeHandler(
    req: Request,
    context?: { params?: Promise<P> },
  ): Promise<Response> {
    try {
      const ipResult = getLimiter("ip").check(`ip:${getClientIp(req)}`);
      if (!ipResult.allowed) return tooManyRequests(ipResult, "ip");

      if (!SAFE_METHODS.has(req.method) && isCrossSiteRequest(req)) {
        return jsonError(403, "Cross-site requests aren't allowed.", { code: "forbidden" });
      }

      let auth;
      try {
        auth = await getAuthenticatedContext();
      } catch (error) {
        if (error instanceof SupabaseConfigError) {
          console.error(`[${config.tag}] ${error.message}`);
          return jsonError(503, "This deployment isn't fully configured yet. Please try again later.", {
            code: "not_configured",
          });
        }
        console.error(`[${config.tag}] auth check failed: ${describeError(error)}`);
        return jsonError(503, "Sign-in couldn't be verified right now. Please try again in a moment.", {
          code: "auth_unavailable",
        });
      }

      if (!auth) {
        return jsonError(401, "You need to be signed in to do that.", { code: "unauthenticated" });
      }

      if (config.limit !== "none") {
        const result = getLimiter(config.limit).check(`${config.limit}:${auth.user.id}`);
        if (!result.allowed) return tooManyRequests(result, "user");
      }

      const params = (context?.params ? await context.params : {}) as P;
      return await handler({ req, params, user: auth.user, supabase: auth.supabase });
    } catch (error) {
      console.error(`[${config.tag}] unexpected error: ${describeError(error)}`);
      return jsonError(500, "Something went wrong on our end. Please try again.", {
        code: "server_error",
      });
    }
  };
}
