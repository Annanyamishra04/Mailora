import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthPage, isProtectedPath, safeRedirectPath } from "../src/lib/routes.ts";

test("safeRedirectPath accepts same-origin relative paths", () => {
  assert.equal(safeRedirectPath("/compose"), "/compose");
  assert.equal(safeRedirectPath("/compose?id=abc-123"), "/compose?id=abc-123");
  assert.equal(safeRedirectPath("/history?q=caf%C3%A9"), "/history?q=caf%C3%A9", "legitimate encoded query survives");
  assert.equal(safeRedirectPath("/history?type=draft#top"), "/history?type=draft#top");
});

test("safeRedirectPath blocks open-redirect attempts", () => {
  const attacks = [
    "https://evil.example",
    "http://evil.example/dashboard",
    "//evil.example",
    "//evil.example/dashboard",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example", // browsers strip the tab → "//evil.example"
    "/\n/evil.example",
    "/%2F%2Fevil.example", // decodes to //evil.example
    "/%5Cevil.example", // decodes to /\evil.example
    "/%09/evil.example", // decodes to a tab, which browsers strip
    "/%E0%A4%A", // malformed percent-encoding
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "evil.example",
    "",
    "/%0d%0a" + "x".repeat(3000), // absurdly long
  ];
  for (const attack of attacks) {
    assert.equal(safeRedirectPath(attack), "/dashboard", `should have rejected: ${JSON.stringify(attack.slice(0, 40))}`);
  }
});

test("safeRedirectPath never bounces back into auth pages or the API", () => {
  assert.equal(safeRedirectPath("/login"), "/dashboard");
  assert.equal(safeRedirectPath("/signup?x=1"), "/dashboard");
  assert.equal(safeRedirectPath("/api/emails"), "/dashboard");
  assert.equal(safeRedirectPath(null), "/dashboard");
  assert.equal(safeRedirectPath(undefined, "/history"), "/history");
});

test("path classification", () => {
  for (const p of ["/dashboard", "/compose", "/reply", "/templates", "/history", "/settings", "/history/x"]) {
    assert.equal(isProtectedPath(p), true, p);
  }
  for (const p of ["/", "/login", "/signup", "/api/emails", "/composer", "/historyx"]) {
    assert.equal(isProtectedPath(p), false, p);
  }
  assert.equal(isAuthPage("/login"), true);
  assert.equal(isAuthPage("/dashboard"), false);
});
