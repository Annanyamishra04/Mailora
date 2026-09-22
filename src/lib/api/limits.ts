import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

/**
 * Configured limiters for the API layer. Best-effort and per server
 * instance — see `lib/rate-limit.ts` for exactly what that does and doesn't
 * guarantee. Limits are tunable with environment variables; invalid values
 * fall back to the defaults (with a one-time warning naming the variable).
 *
 *   ai     per authenticated user, every /api/ai/* call
 *          AI_RATE_LIMIT_MAX (default 15)   AI_RATE_LIMIT_WINDOW_MS (default 60000)
 *   write  per authenticated user, every email/template create/update/delete
 *          API_RATE_LIMIT_MAX (default 120) API_RATE_LIMIT_WINDOW_MS (default 60000)
 *   ip     per client IP, every /api/* call, checked BEFORE any Supabase
 *          round trip so anonymous floods stay cheap
 *          API_IP_RATE_LIMIT_MAX (default 300) — uses API_RATE_LIMIT_WINDOW_MS
 */

export type LimiterKind = "ai" | "write" | "ip";

interface Config {
  max: number;
  windowMs: number;
}

const DEFAULT_WINDOW_MS = 60_000;

function readInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    console.warn(
      `[rate-limit] ${name} must be an integer between ${min} and ${max}; using default ${fallback}.`,
    );
    return fallback;
  }
  return value;
}

function readConfig(kind: LimiterKind): Config {
  switch (kind) {
    case "ai":
      return {
        max: readInt("AI_RATE_LIMIT_MAX", 15, 1, 10_000),
        windowMs: readInt("AI_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS, 1_000, 3_600_000),
      };
    case "write":
      return {
        max: readInt("API_RATE_LIMIT_MAX", 120, 1, 100_000),
        windowMs: readInt("API_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS, 1_000, 3_600_000),
      };
    case "ip":
      return {
        max: readInt("API_IP_RATE_LIMIT_MAX", 300, 1, 100_000),
        windowMs: readInt("API_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS, 1_000, 3_600_000),
      };
  }
}

// Route handlers can be bundled separately; anchoring on globalThis lets
// every route in one process share the same counters (and survive dev HMR).
const STORE = Symbol.for("ai-mail-studio.rate-limiters");
type Store = Partial<Record<LimiterKind, RateLimiter>>;

export function getLimiter(kind: LimiterKind): RateLimiter {
  const holder = globalThis as unknown as Record<symbol, Store | undefined>;
  const store = (holder[STORE] ??= {});
  return (store[kind] ??= createRateLimiter(readConfig(kind)));
}
