/**
 * Central, non-crashing environment inspection.
 *
 * Philosophy: a missing variable must never break `next build` (CI and
 * local development legitimately run without secrets), and must never be
 * silently ignored at runtime either. So:
 *
 *  - Each server operation validates what it needs at the moment it runs
 *    and fails with a clear, secret-free error (see `lib/ai/providers`,
 *    `lib/supabase/errors.ts`).
 *  - `getEnvIssues()` reports problems by variable NAME only — never values —
 *    and is logged once at server start (`src/instrumentation.ts`) and
 *    mirrored by `npm run check:env` for pre-deploy checks.
 *
 * Nothing here reads a secret's value into a message.
 */

/**
 * Default Gemini model. Google retires models on a rolling schedule
 * (gemini-2.0-flash was shut down on 2026-06-01), so ALWAYS set
 * GEMINI_MODEL explicitly in production and re-check
 * https://ai.google.dev/gemini-api/docs/deprecations periodically.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

/** Model ids are interpolated into a URL path, so only a safe charset is allowed. */
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export const KNOWN_AI_PROVIDERS = ["gemini"] as const;

export interface EnvIssue {
  name: string;
  severity: "error" | "warning";
  message: string;
}

export function getGeminiModelFromEnv(): { model: string; valid: boolean; fromEnv: boolean } {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (!configured) return { model: DEFAULT_GEMINI_MODEL, valid: true, fromEnv: false };
  return { model: configured, valid: MODEL_PATTERN.test(configured), fromEnv: true };
}

export function getAiProviderFromEnv(): string {
  return process.env.AI_PROVIDER?.trim().toLowerCase() || "gemini";
}

const SECRET_LOOKING = /(SECRET|SERVICE_ROLE|GEMINI|PRIVATE|PASSWORD|TOKEN|API_KEY)/i;
const ALLOWED_PUBLIC = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

function decodeJwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function getEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const env = process.env;
  const isProduction = env.NODE_ENV === "production";

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    issues.push({ name: "NEXT_PUBLIC_SUPABASE_URL", severity: "error", message: "Missing — sign-in, saving, and every AI route are unavailable." });
  } else {
    try {
      const parsed = new URL(url);
      if (isProduction && parsed.protocol !== "https:") {
        issues.push({ name: "NEXT_PUBLIC_SUPABASE_URL", severity: "warning", message: "Not https — use your project's https URL in production." });
      }
    } catch {
      issues.push({ name: "NEXT_PUBLIC_SUPABASE_URL", severity: "error", message: "Not a valid URL." });
    }
  }

  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) {
    issues.push({ name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", severity: "error", message: "Missing — sign-in, saving, and every AI route are unavailable." });
  } else if (decodeJwtRole(anon) === "service_role") {
    issues.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      severity: "error",
      message: "Contains a service_role key. That key bypasses Row Level Security and is shipped to every browser. Replace it with the anon/publishable key immediately and rotate the leaked key.",
    });
  }

  if (!env.GEMINI_API_KEY) {
    issues.push({ name: "GEMINI_API_KEY", severity: "error", message: "Missing — AI features will return a configuration error." });
  }

  const model = getGeminiModelFromEnv();
  if (!model.valid) {
    issues.push({ name: "GEMINI_MODEL", severity: "error", message: "Contains characters that aren't allowed in a model id." });
  } else if (!model.fromEnv) {
    issues.push({ name: "GEMINI_MODEL", severity: "warning", message: `Unset — defaulting to ${DEFAULT_GEMINI_MODEL}. Google retires models often; set this explicitly.` });
  }

  const provider = getAiProviderFromEnv();
  if (!(KNOWN_AI_PROVIDERS as readonly string[]).includes(provider)) {
    issues.push({ name: "AI_PROVIDER", severity: "error", message: `Unknown provider. Supported: ${KNOWN_AI_PROVIDERS.join(", ")}.` });
  }

  for (const name of Object.keys(env)) {
    if (name.startsWith("NEXT_PUBLIC_") && !ALLOWED_PUBLIC.has(name) && SECRET_LOOKING.test(name)) {
      issues.push({
        name,
        severity: "error",
        message: "NEXT_PUBLIC_ variables are embedded in browser JavaScript. This name looks like a secret — remove the NEXT_PUBLIC_ prefix.",
      });
    }
  }

  return issues;
}
