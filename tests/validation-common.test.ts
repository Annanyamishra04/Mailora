import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasUnstorableCharacters,
  isUuid,
  readEnum,
  readString,
  rejectUnknownKeys,
} from "../src/lib/validation/common.ts";

test("isUuid accepts only canonical UUIDs", () => {
  assert.equal(isUuid("3f2b8c1e-9d4a-4b6e-8a1f-2c5d7e9f0a1b"), true);
  assert.equal(isUuid("3F2B8C1E-9D4A-4B6E-8A1F-2C5D7E9F0A1B"), true);
  for (const bad of ["", "abc", "1", "../../etc/passwd", "3f2b8c1e9d4a4b6e8a1f2c5d7e9f0a1b", "3f2b8c1e-9d4a-4b6e-8a1f-2c5d7e9f0a1b'; drop table emails;--", null, undefined, 42, {}]) {
    assert.equal(isUuid(bad), false, String(bad));
  }
});

test("rejectUnknownKeys rejects user_id and other smuggled fields", () => {
  const allowed = ["subject", "body"];
  assert.equal(rejectUnknownKeys({ subject: "s", body: "b" }, allowed), null);
  assert.match(rejectUnknownKeys({ subject: "s", user_id: "someone-else" }, allowed) ?? "", /user_id/);
  assert.match(rejectUnknownKeys({ id: "x" }, allowed) ?? "", /id/);
  const long = rejectUnknownKeys({ ["k".repeat(500)]: 1 }, allowed) ?? "";
  assert.ok(long.length < 100, "echoed key must be truncated");
});

test("readString: required, trim, and length behaviour", () => {
  assert.deepEqual(readString({ a: "  hi  " }, "a", { required: true, maxLength: 10, trim: true }), { ok: true, value: "hi" });
  assert.deepEqual(readString({ a: "  hi  " }, "a", { required: true, maxLength: 10 }), { ok: true, value: "  hi  " });
  assert.equal(readString({ a: "   " }, "a", { required: true, maxLength: 10 }).ok, false);
  assert.equal(readString({}, "a", { required: true, maxLength: 10 }).ok, false);
  assert.deepEqual(readString({}, "a", { required: false, maxLength: 10 }), { ok: true, value: "" });
  assert.equal(readString({ a: "x".repeat(11) }, "a", { required: false, maxLength: 10 }).ok, false);
  assert.equal(readString({ a: 5 }, "a", { required: false, maxLength: 10 }).ok, false);
  assert.equal(readString({ a: ["x"] }, "a", { required: false, maxLength: 10 }).ok, false);
});

test("readString rejects text Postgres cannot store (NUL, lone surrogates)", () => {
  assert.equal(readString({ a: "hello\u0000world" }, "a", { required: false, maxLength: 100 }).ok, false);
  assert.equal(readString({ a: "bad\ud800" }, "a", { required: false, maxLength: 100 }).ok, false);
  assert.equal(readString({ a: "fine 😀 नमस्ते" }, "a", { required: false, maxLength: 100 }).ok, true);
  assert.equal(hasUnstorableCharacters("ok"), false);
});

test("readEnum restricts to the allowed set", () => {
  const set = new Set(["short", "medium"]);
  assert.deepEqual(readEnum({ l: "short" }, "l", set), { ok: true, value: "short" });
  assert.equal(readEnum({ l: "huge" }, "l", set).ok, false);
  assert.equal(readEnum({}, "l", set).ok, false);
  assert.equal(readEnum({ l: ["short"] }, "l", set).ok, false);
});
