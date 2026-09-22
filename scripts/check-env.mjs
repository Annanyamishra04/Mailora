#!/usr/bin/env node
/**
 * Pre-deploy environment check.   Usage:  npm run check:env
 *
 * Reads the current environment (and `.env.local` / `.env.production.local`
 * if present) and reports what's missing or wrong by variable NAME. It never
 * prints a value. Exits 1 if anything required is missing or unsafe, so it
 * can gate CI/CD:   `npm run check:env && npm run build`
 *
 * Deliberately separate from `next build`: the build must keep working
 * without secrets (CI, local dev), while this is the explicit "am I ready to
 * deploy?" gate. Logic mirrors `src/lib/env.ts` (which logs at server start).
 */
import { existsSync } from "node:fs";

for (const file of [".env.production.local", ".env.local"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file); // Node >= 20.12; doesn't override variables already set
    } catch {
      /* unreadable file: fall through to whatever is in the process env */
    }
  }
}

const env = process.env;
const problems = [];
const notes = [];
const ok = [];

const add = (list, name, message) => list.push({ name, message });

function jwtRole(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

// --- Required -------------------------------------------------------------
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) add(problems, "NEXT_PUBLIC_SUPABASE_URL", "missing (Supabase → Project Settings → API → Project URL)");
else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") add(problems, "NEXT_PUBLIC_SUPABASE_URL", "must be an https:// URL for a deployed app");
    else add(ok, "NEXT_PUBLIC_SUPABASE_URL", "set");
  } catch {
    add(problems, "NEXT_PUBLIC_SUPABASE_URL", "not a valid URL");
  }
}

const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!anon) add(problems, "NEXT_PUBLIC_SUPABASE_ANON_KEY", "missing (Supabase → Project Settings → API → anon / publishable key)");
else if (jwtRole(anon) === "service_role") {
  add(problems, "NEXT_PUBLIC_SUPABASE_ANON_KEY", "this is a SERVICE-ROLE key. It bypasses Row Level Security and would be shipped to every browser. Use the anon/publishable key and rotate the exposed one.");
} else add(ok, "NEXT_PUBLIC_SUPABASE_ANON_KEY", "set");

if (!env.GEMINI_API_KEY) add(problems, "GEMINI_API_KEY", "missing — every AI feature will return a configuration error (https://aistudio.google.com/apikey)");
else add(ok, "GEMINI_API_KEY", "set");

// --- Recommended / optional ----------------------------------------------
const model = env.GEMINI_MODEL?.trim();
if (!model) {
  add(notes, "GEMINI_MODEL", "unset — falls back to the built-in default. Google retires models often (gemini-2.0-flash was shut down 2026-06-01); set it explicitly and check https://ai.google.dev/gemini-api/docs/deprecations");
} else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(model)) {
  add(problems, "GEMINI_MODEL", "contains characters that aren't allowed in a model id");
} else if (/^gemini-2\.0-/.test(model)) {
  add(problems, "GEMINI_MODEL", "gemini-2.0-* models were shut down on 2026-06-01 and will fail — choose a current model");
} else add(ok, "GEMINI_MODEL", "set");

const provider = (env.AI_PROVIDER || "gemini").trim().toLowerCase();
if (provider !== "gemini") add(problems, "AI_PROVIDER", 'unsupported value (only "gemini" is implemented)');
else add(ok, "AI_PROVIDER", env.AI_PROVIDER ? "set" : "unset (defaults to gemini)");

if (env.SUPABASE_SERVICE_ROLE_KEY) {
  add(notes, "SUPABASE_SERVICE_ROLE_KEY", "set, but no route in this app uses it. Least privilege says: don't put it in Vercel unless you add a privileged server job.");
} else add(ok, "SUPABASE_SERVICE_ROLE_KEY", "unset (not needed by any current route)");

for (const name of ["AI_RATE_LIMIT_MAX", "AI_RATE_LIMIT_WINDOW_MS", "API_RATE_LIMIT_MAX", "API_RATE_LIMIT_WINDOW_MS", "API_IP_RATE_LIMIT_MAX"]) {
  const raw = env[name];
  if (raw !== undefined && raw !== "" && !(Number.isInteger(Number(raw)) && Number(raw) > 0)) {
    add(notes, name, "not a positive integer — the default will be used");
  }
}

// --- Accidental exposure --------------------------------------------------
const allowedPublic = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
for (const name of Object.keys(env)) {
  if (name.startsWith("NEXT_PUBLIC_") && !allowedPublic.has(name) && /(SECRET|SERVICE_ROLE|GEMINI|PRIVATE|PASSWORD|TOKEN|API_KEY)/i.test(name)) {
    add(problems, name, "NEXT_PUBLIC_ variables are embedded in browser JavaScript; this name looks like a secret — remove the prefix");
  }
}

// --- Report ---------------------------------------------------------------
const pad = (s) => s.padEnd(34);
console.log("\nAI Mail Studio — environment check (values are never printed)\n");
for (const { name, message } of ok) console.log(`  ✔ ${pad(name)} ${message}`);
for (const { name, message } of notes) console.log(`  ! ${pad(name)} ${message}`);
for (const { name, message } of problems) console.log(`  ✖ ${pad(name)} ${message}`);
console.log(problems.length ? `\n${problems.length} problem(s) must be fixed before deploying.\n` : "\nReady to deploy from an environment standpoint.\n");
process.exit(problems.length ? 1 : 0);
