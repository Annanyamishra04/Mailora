import { generateEmail } from "@/lib/ai";
import { createAiRoute } from "@/lib/api/ai-route";
import { validateGenerateEmailRequest } from "@/lib/validation/ai";

// Gemini calls are capped at 20s in the provider; leave headroom for auth + validation.
export const maxDuration = 30;

/**
 * POST /api/ai/generate-email — requires a signed-in user (401 otherwise), is rate
 * limited per user (429), and validates its body strictly before any
 * provider call. See `lib/api/ai-route.ts` and `lib/api/guard.ts`.
 */
export const POST = createAiRoute({
  tag: "api/ai/generate-email",
  validate: validateGenerateEmailRequest,
  run: generateEmail,
});
