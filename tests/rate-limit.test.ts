import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/lib/rate-limit.ts";

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

test("allows up to `max` requests, then denies with a Retry-After", () => {
  const c = clock(0);
  const limiter = createRateLimiter({ max: 3, windowMs: 60_000, now: c.now });
  for (let i = 0; i < 3; i++) assert.equal(limiter.check("u").allowed, true);

  const denied = limiter.check("u");
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.ok(denied.retryAfterSeconds >= 1 && denied.retryAfterSeconds <= 60);
});

test("keys are independent", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 60_000, now: clock(0).now });
  assert.equal(limiter.check("a").allowed, true);
  assert.equal(limiter.check("a").allowed, false);
  assert.equal(limiter.check("b").allowed, true);
});

test("capacity returns once the window has fully passed", () => {
  const c = clock(0);
  const limiter = createRateLimiter({ max: 2, windowMs: 10_000, now: c.now });
  limiter.check("u");
  limiter.check("u");
  assert.equal(limiter.check("u").allowed, false);
  c.advance(20_000);
  assert.equal(limiter.check("u").allowed, true);
});

test("sliding window: cannot burst 2x the limit across a window boundary", () => {
  const c = clock(0);
  const limiter = createRateLimiter({ max: 10, windowMs: 60_000, now: c.now });
  c.advance(59_000); // end of window 0
  let first = 0;
  for (let i = 0; i < 10; i++) if (limiter.check("u").allowed) first++;
  assert.equal(first, 10);

  c.advance(2_000); // just into window 1: a fixed-window limiter would allow 10 more here
  let second = 0;
  for (let i = 0; i < 10; i++) if (limiter.check("u").allowed) second++;
  assert.ok(second <= 1, `expected almost no burst allowance, got ${second}`);
});

test("previous-window hits decay smoothly", () => {
  const c = clock(0);
  const limiter = createRateLimiter({ max: 10, windowMs: 60_000, now: c.now });
  for (let i = 0; i < 10; i++) limiter.check("u");
  c.advance(60_000 + 30_000); // halfway through the next window → ~half the old hits still count
  let allowed = 0;
  for (let i = 0; i < 10; i++) if (limiter.check("u").allowed) allowed++;
  assert.ok(allowed >= 4 && allowed <= 6, `expected ~5, got ${allowed}`);
});

test("memory is bounded when keys keep changing", () => {
  const limiter = createRateLimiter({ max: 5, windowMs: 60_000, maxKeys: 100, now: clock(0).now });
  for (let i = 0; i < 5_000; i++) limiter.check(`attacker-${i}`);
  assert.ok(limiter.size <= 100, `tracked ${limiter.size} keys`);
});

test("rejects nonsensical configuration", () => {
  assert.throws(() => createRateLimiter({ max: 0, windowMs: 1000 }));
  assert.throws(() => createRateLimiter({ max: 5, windowMs: 0 }));
  assert.throws(() => createRateLimiter({ max: Number.NaN, windowMs: 1000 }));
});
