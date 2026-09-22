#!/usr/bin/env node
/**
 * Post-build guard: fails if a secret ended up in anything shipped to the browser.
 * Usage:  npm run build && npm run check:bundle
 *
 * Scans `.next/static` (every JS/CSS chunk the browser downloads) and the
 * prerendered HTML in `.next/server/app`. It looks for:
 *   1. the exact values of GEMINI_API_KEY / SUPABASE_SERVICE_ROLE_KEY, if set
 *      in this shell (run it with your real env to prove they don't leak);
 *   2. anything shaped like a Google API key (AIza…);
 *   3. any JWT whose decoded `role` is `service_role`.
 * Never prints a matched secret — only the file it was found in.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const roots = [".next/static", ".next/server/app"].filter(existsSync);
if (roots.length === 0) {
  console.error("No .next build output found — run `npm run build` first.");
  process.exit(2);
}

const literals = ["GEMINI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  .map((name) => ({ name, value: process.env[name] }))
  .filter((entry) => entry.value && entry.value.length >= 8);

const GOOGLE_KEY = /AIza[0-9A-Za-z_-]{35}/;
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(js|mjs|css|html|json|rsc|txt|map)$/.test(path)) yield path;
  }
}

function jwtRole(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")).role;
  } catch {
    return null;
  }
}

const findings = [];
let scanned = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    scanned += 1;
    const text = readFileSync(file, "utf8");
    for (const { name, value } of literals) {
      if (text.includes(value)) findings.push(`${file}: contains the value of ${name}`);
    }
    if (GOOGLE_KEY.test(text)) findings.push(`${file}: contains a Google API key pattern (AIza…)`);
    for (const token of text.match(JWT) ?? []) {
      if (jwtRole(token) === "service_role") findings.push(`${file}: contains a service_role JWT`);
    }
  }
}

if (findings.length) {
  console.error(`\n✖ Secret material found in client-visible build output:\n`);
  for (const f of new Set(findings)) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}
console.log(
  `✔ Scanned ${scanned} client-visible files; no secrets found` +
    (literals.length ? ` (checked exact values of ${literals.map((l) => l.name).join(", ")}).` : ` (no secret env vars set in this shell, so only patterns were checked).`),
);
