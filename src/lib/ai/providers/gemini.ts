import "server-only";
 
import { AiError } from "@/lib/ai/errors";
import { getGeminiModelFromEnv } from "@/lib/env";
import type { AiCompletionRequest, AiProviderAdapter, AiResponseShape } from "@/lib/ai/types";
 
/**
 * GEMINI PROVIDER ADAPTER
 *
 * Talks to Google's Gemini API over plain REST (no SDK dependency). Chosen
 * because Google AI Studio issues a genuinely free API key for development
 * (rate-limited, not "unlimited free"), and the API supports native
 * structured JSON output, which fits this app's request/response shapes.
 *
 * Nothing outside this file knows it's Gemini — `lib/ai/index.ts` only
 * depends on the `AiProviderAdapter` interface, so replacing this with a
 * different provider later is a matter of adding one new adapter file and
 * pointing `lib/ai/provider.ts` at it.
 *
 * Security notes:
 *  - The API key is sent in the `x-goog-api-key` header, not the URL, so it
 *    can't end up in a logged URL, an error message, or a `cause`.
 *  - The model id comes from an env var and is interpolated into the URL
 *    path, so it's validated against a strict charset first.
 *  - Nothing from a failed provider response is returned to the client.
 */
 
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_AFTER_SECONDS = 30;
 
/**
 * Output ceilings per request kind. Newer Gemini models "think" before
 * answering and thinking tokens count against this limit, so the ceiling
 * needs real headroom over the visible answer — and a rewrite has to be
 * able to return the whole (up to 20,000-character) email it was given.
 */
const MAX_OUTPUT_TOKENS: Record<AiResponseShape, number> = {
  email: 2048,
  reply: 2048,
  subject: 512,
  rewrite: 8192,
  summary: 2048,
  "action-items": 2048,
};
 
const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "IMAGE_SAFETY",
]);
 
const UNAVAILABLE_MESSAGE = "AI features are temporarily unavailable. Please try again later.";
 
function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AiError("not_configured", "AI features aren't set up for this deployment yet.", {
      devHint: "Add GEMINI_API_KEY to .env.local — see .env.example",
    });
  }
  return key;
}
 
function getModel(): string {
  const { model, valid } = getGeminiModelFromEnv();
  if (!valid) {
    throw new AiError("not_configured", UNAVAILABLE_MESSAGE, {
      cause: "GEMINI_MODEL contains characters that aren't allowed in a model id",
      devHint: "GEMINI_MODEL may only contain letters, digits, '.', '_' and '-'",
    });
  }
  return model;
}
 
interface GeminiPart {
  text?: string;
  thought?: boolean;
}
 
interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}
 
function parseRetryAfter(header: string | null): number {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 1 && seconds <= 300) return Math.ceil(seconds);
  return DEFAULT_RETRY_AFTER_SECONDS;
}
 
/**
 * Gemini's free tier occasionally returns 503 "the model is currently
 * experiencing high demand" — a transient overload on Google's side, not a
 * problem with the request. One quick, silent retry clears most of these
 * without the user having to click "Generate" again. We deliberately retry
 * only this one specific, fast-failing case (never on timeout/network
 * errors, which already ate most of the 20s budget) so a retry can't push
 * the route past its 30s `maxDuration`.
 */
const OVERLOAD_RETRY_DELAY_MS = 1200;
 
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
 
function isOverloadError(error: unknown): boolean {
  return (
    error instanceof AiError &&
    error.code === "provider_error" &&
    typeof error.cause === "string" &&
    /Gemini responded with 503/.test(error.cause) &&
    /"status":\s*"UNAVAILABLE"/.test(error.cause)
  );
}
 
async function complete(request: AiCompletionRequest): Promise<string> {
  try {
    return await attemptComplete(request);
  } catch (error) {
    if (!isOverloadError(error)) throw error;
    await sleep(OVERLOAD_RETRY_DELAY_MS);
    return attemptComplete(request);
  }
}
 
async function attemptComplete(request: AiCompletionRequest): Promise<string> {
  const apiKey = getApiKey();
  const model = getModel();
  const url = `${API_BASE}/${model}:generateContent`;
 
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
 
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
          maxOutputTokens: MAX_OUTPUT_TOKENS[request.responseShape],
        },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiError("timeout", "The AI provider took too long to respond. Please try again.", {
        cause: error,
      });
    }
    throw new AiError("network_error", "Couldn't reach the AI provider. Please try again.", {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
 
  if (response.status === 401 || response.status === 403) {
    throw new AiError("not_configured", UNAVAILABLE_MESSAGE, {
      status: 503,
      cause: `Gemini responded with ${response.status}`,
      devHint: "Gemini rejected GEMINI_API_KEY — check that it is valid and the API is enabled for it",
    });
  }
 
  if (response.status === 404) {
    throw new AiError("not_configured", UNAVAILABLE_MESSAGE, {
      status: 503,
      cause: `Gemini responded with 404 for model "${model}"`,
      devHint: `Model "${model}" wasn't found — it may have been retired. Set GEMINI_MODEL to a current model (https://ai.google.dev/gemini-api/docs/models)`,
    });
  }
 
  if (response.status === 429) {
    throw new AiError(
      "rate_limited",
      "The AI provider is rate-limiting requests right now. Please wait a moment and try again.",
      {
        cause: `Gemini responded with ${response.status}`,
        retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
      },
    );
  }
 
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    // Gemini reports a bad key as HTTP 400 "API key not valid", not 401.
    if (response.status === 400 && /api key/i.test(bodyText)) {
      throw new AiError("not_configured", UNAVAILABLE_MESSAGE, {
        status: 503,
        cause: "Gemini responded with 400 (API key not valid)",
        devHint: "Gemini rejected GEMINI_API_KEY — check that it is valid",
      });
    }
    throw new AiError("provider_error", "The AI provider couldn't complete that request. Please try again.", {
      cause: `Gemini responded with ${response.status}: ${bodyText.slice(0, 300)}`,
    });
  }
 
  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (error) {
    throw new AiError("invalid_response", "The AI provider returned something we couldn't read. Please try again.", {
      cause: error,
    });
  }
 
  if (data.promptFeedback?.blockReason) {
    throw new AiError(
      "invalid_request",
      "That request couldn't be completed — try rephrasing what you'd like the email to say.",
      { cause: `Blocked: ${data.promptFeedback.blockReason}` },
    );
  }
 
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text as string)
    .join("");
 
  if (finishReason === "MAX_TOKENS") {
    // The JSON is cut off mid-string; never try to parse a truncated payload.
    throw new AiError(
      "invalid_response",
      "That response was cut off before it finished. Try again, or use shorter text.",
      { cause: "Gemini finishReason MAX_TOKENS" },
    );
  }
 
  if (!text.trim()) {
    if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) {
      throw new AiError(
        "invalid_request",
        "That request couldn't be completed — try rephrasing what you'd like the email to say.",
        { cause: `Blocked: ${finishReason}` },
      );
    }
    throw new AiError("invalid_response", "The AI provider returned an empty response. Please try again.", {
      cause: `No text in Gemini response (finishReason: ${finishReason ?? "none"})`,
    });
  }
 
  return text;
}
 
export const geminiProvider: AiProviderAdapter = {
  name: "gemini",
  complete,
};
 