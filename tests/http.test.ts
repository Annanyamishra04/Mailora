import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY_LIMITS, getClientIp, isCrossSiteRequest, readJsonBody } from "../src/lib/http.ts";

const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

test("parses a valid JSON body", async () => {
  const result = await readJsonBody(post('{"a":1}'), { maxBytes: 1024 });
  assert.deepEqual(result, { ok: true, data: { a: 1 } });
});

test("rejects a non-JSON content type with 415", async () => {
  const result = await readJsonBody(post("{}", { "content-type": "text/plain" }), { maxBytes: 1024 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 415);
});

test("rejects an empty or missing body", async () => {
  for (const body of ["", null]) {
    const result = await readJsonBody(post(body as string | null), { maxBytes: 1024 });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  }
});

test("rejects malformed JSON and invalid UTF-8 with 400", async () => {
  const bad = await readJsonBody(post("{not json"), { maxBytes: 1024 });
  assert.equal(bad.ok === false && bad.status, 400);

  const invalidUtf8 = await readJsonBody(post(new Uint8Array([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x7d])), { maxBytes: 1024 });
  assert.equal(invalidUtf8.ok === false && invalidUtf8.status, 400);
});

test("rejects on declared Content-Length before reading anything", async () => {
  let pulled = false;
  // highWaterMark 0: `pull` only runs when something actually reads the stream
  // (by default a stream eagerly pre-fills its buffer, which would fake a read).
  const stream = new ReadableStream(
    {
      pull(controller) {
        pulled = true;
        controller.enqueue(new TextEncoder().encode("{}"));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const req = new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "content-length": "999999" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  const result = await readJsonBody(req, { maxBytes: 1024 });
  assert.equal(result.ok === false && result.status, 413);
  assert.equal(pulled, false, "must not touch the body when Content-Length already exceeds the limit");
});

test("aborts a streamed body that exceeds the limit even with no Content-Length", async () => {
  let chunksSent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      chunksSent++;
      controller.enqueue(new Uint8Array(1024).fill(0x61));
      if (chunksSent > 1000) controller.close(); // would be ~1 MB if never stopped
    },
  });
  const req = new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  const result = await readJsonBody(req, { maxBytes: 4096 });
  assert.equal(result.ok === false && result.status, 413);
  assert.ok(chunksSent < 20, `kept reading after the limit (${chunksSent} chunks)`);
});

test("limits are in BYTES: 20,000 Devanagari characters (~60 KB) still fit the AI limit", async () => {
  const text = "नमस्ते".repeat(3400).slice(0, 20_000); // 3 bytes per char in UTF-8
  const payload = JSON.stringify({ body: text, action: "polish" });
  assert.ok(new TextEncoder().encode(payload).length > 55_000);
  const result = await readJsonBody(post(payload), { maxBytes: BODY_LIMITS.ai });
  assert.equal(result.ok, true);
});

test("a maximum-size saved email (30,000-char body of 4-byte chars) fits the email limit", async () => {
  const payload = JSON.stringify({ subject: "s", body: "😀".repeat(15_000) }); // 30,000 UTF-16 units
  const result = await readJsonBody(post(payload), { maxBytes: BODY_LIMITS.email });
  assert.equal(result.ok, true);
});

test("cross-site detection", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://app.example.com/api/emails", { method: "POST", headers });

  assert.equal(isCrossSiteRequest(req({ origin: "https://app.example.com", host: "app.example.com" })), false);
  assert.equal(isCrossSiteRequest(req({ origin: "https://evil.example", host: "app.example.com" })), true);
  assert.equal(isCrossSiteRequest(req({ origin: "null", host: "app.example.com" })), true);
  assert.equal(isCrossSiteRequest(req({ "sec-fetch-site": "cross-site" })), true);
  assert.equal(isCrossSiteRequest(req({ "sec-fetch-site": "same-site" })), true);
  assert.equal(isCrossSiteRequest(req({ "sec-fetch-site": "same-origin" })), false);
  assert.equal(isCrossSiteRequest(req({})), false, "curl / server-to-server: no browser headers");
  assert.equal(
    isCrossSiteRequest(req({ origin: "https://app.example.com", "x-forwarded-host": "app.example.com", host: "internal" })),
    false,
  );
});

test("client IP extraction ignores garbage", () => {
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  assert.equal(getClientIp(req({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(getClientIp(req({ "x-vercel-forwarded-for": "2001:db8::1", "x-forwarded-for": "1.1.1.1" })), "2001:db8::1");
  assert.equal(getClientIp(req({ "x-forwarded-for": "<script>alert(1)</script>" })), "unknown");
  assert.equal(getClientIp(req({})), "unknown");
});
