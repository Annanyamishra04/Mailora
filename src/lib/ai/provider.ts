import { AiError } from "./errors";
import { geminiProvider } from "./providers/gemini";
import { KNOWN_AI_PROVIDERS, getAiProviderFromEnv } from "@/lib/env";
import type { AiProviderAdapter } from "./types";

/**
 * Resolves which provider adapter handles AI requests. Currently only
 * Gemini is registered; adding another provider later means writing a new
 * adapter under `lib/ai/providers/` and adding one case here (optionally
 * switched via the AI_PROVIDER env var) — no other file needs to change.
 */
export function getProvider(): AiProviderAdapter {
  const configured = getAiProviderFromEnv();

  switch (configured) {
    case "gemini":
      return geminiProvider;
    default:
      throw new AiError("not_configured", "AI features aren't set up for this deployment yet.", {
        cause: `Unknown AI_PROVIDER "${configured.slice(0, 40)}"`,
        devHint: `AI_PROVIDER must be one of: ${KNOWN_AI_PROVIDERS.join(", ")}`,
      });
  }
}
