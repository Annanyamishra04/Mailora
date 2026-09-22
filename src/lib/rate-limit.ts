/**
 * Best-effort, in-memory rate limiter.
 *
 * !! Not distributed. State lives in the memory of one server process. On
 * serverless platforms (Vercel) requests can be served by many independent
 * instances that don't share memory, and instances are recycled, so the
 * effective limit is "per warm instance", not "per user globally". This is
 * meant to stop obvious hammering (a stuck retry loop, a script) for free —
 * not to be a security boundary or a billing guard. For hard guarantees use
 * a shared store (e.g. Redis/Upstash) behind the same `check()` interface.
 *
 * Algorithm: sliding-window counter. Each key keeps the hit count for the
 * current fixed window and the previous one; the effective count is
 * `previous × (fraction of previous window still in range) + current`. That
 * avoids the fixed-window flaw where a client can burst 2× the limit across a
 * window boundary, while staying O(1) memory per key.
 *
 * No imports: usable from anywhere and unit-testable in plain Node.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  /** Requests still available in the current window (0 when denied). */
  remaining: number;
  /** Whole seconds to wait before retrying; 0 when allowed. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  /** Drops all state. Mainly for tests. */
  clear(): void;
  readonly size: number;
}

export interface RateLimiterOptions {
  /** Max requests per window per key. */
  max: number;
  windowMs: number;
  /** Cap on tracked keys, so rotating keys can't grow memory unboundedly. */
  maxKeys?: number;
  /** Injectable clock, for tests. */
  now?: () => number;
}

interface Entry {
  /** Index of the fixed window `count` belongs to. */
  window: number;
  count: number;
  /** Hits in the window immediately before `window`. */
  previous: number;
}

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { max, windowMs, maxKeys = DEFAULT_MAX_KEYS, now = Date.now } = options;
  if (!Number.isFinite(max) || max < 1) throw new Error("Rate limiter `max` must be >= 1.");
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Rate limiter `windowMs` must be >= 1.");
  }

  const entries = new Map<string, Entry>();

  function sweep(currentWindow: number) {
    for (const [key, entry] of entries) {
      // Nothing from the previous window can matter once we're 2+ windows on.
      if (entry.window < currentWindow - 1) entries.delete(key);
    }
  }

  function evictOldest(count: number) {
    let remaining = count;
    for (const key of entries.keys()) {
      if (remaining <= 0) break;
      entries.delete(key);
      remaining -= 1;
    }
  }

  return {
    check(key: string): RateLimitResult {
      const time = now();
      const currentWindow = Math.floor(time / windowMs);
      const elapsedFraction = (time % windowMs) / windowMs;

      let entry = entries.get(key);
      if (!entry) {
        if (entries.size >= maxKeys) {
          sweep(currentWindow);
          // Still full of live keys (e.g. an attacker rotating identifiers):
          // make room by dropping the oldest tracked keys.
          if (entries.size >= maxKeys) evictOldest(entries.size - maxKeys + 1);
        }
        entry = { window: currentWindow, count: 0, previous: 0 };
        entries.set(key, entry);
      } else if (entry.window !== currentWindow) {
        entry.previous = entry.window === currentWindow - 1 ? entry.count : 0;
        entry.count = 0;
        entry.window = currentWindow;
        // Re-insert so Map order approximates "least recently active first".
        entries.delete(key);
        entries.set(key, entry);
      }

      const effective = entry.previous * (1 - elapsedFraction) + entry.count;

      if (effective + 1 > max) {
        const msToWindowEnd = windowMs - (time % windowMs);
        return {
          allowed: false,
          limit: max,
          remaining: 0,
          // Upper bound: by the end of this window the previous window has
          // fully aged out. Erring long is safe; erring short invites retries.
          retryAfterSeconds: Math.max(1, Math.ceil(msToWindowEnd / 1000)),
        };
      }

      entry.count += 1;
      return {
        allowed: true,
        limit: max,
        remaining: Math.max(0, Math.floor(max - (effective + 1))),
        retryAfterSeconds: 0,
      };
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    },
  };
}
