import "server-only";

import { getProvider } from "./provider";
import {
  buildActionItemsPrompt,
  buildGenerateEmailPrompt,
  buildGenerateReplyPrompt,
  buildGenerateSubjectPrompt,
  buildRewritePrompt,
  buildSummarizePrompt,
} from "./prompts";
import {
  parseActionItemsResponse,
  parseGenerateEmailResponse,
  parseGenerateReplyResponse,
  parseGenerateSubjectResponse,
  parseRewriteResponse,
  parseSummarizeResponse,
} from "./parse";
import type {
  ActionItemsInput,
  ActionItemsResult,
  GenerateEmailInput,
  GenerateEmailResult,
  GenerateReplyInput,
  GenerateReplyResult,
  GenerateSubjectInput,
  GenerateSubjectResult,
  RewriteEmailInput,
  RewriteEmailResult,
  SummarizeEmailInput,
  SummarizeEmailResult,
} from "./types";

/**
 * Server-only AI service.
 *
 * This is the only module API routes should import for AI operations. It
 * builds the prompt, asks the currently configured provider adapter for a
 * completion, and validates the result before returning it. Swapping the
 * active provider happens in `provider.ts`; nothing here needs to change.
 *
 * Because this file (transitively) touches `process.env.GEMINI_API_KEY`,
 * it's guarded with the `server-only` package so an accidental import from
 * a client component fails the build instead of leaking a secret.
 */

export async function generateEmail(
  input: GenerateEmailInput,
): Promise<GenerateEmailResult> {
  const provider = getProvider();
  const { system, user } = buildGenerateEmailPrompt(input);
  const raw = await provider.complete({
    systemPrompt: system,
    userPrompt: user,
    responseShape: "email",
  });
  return parseGenerateEmailResponse(raw);
}

export async function rewriteEmail(
  input: RewriteEmailInput,
): Promise<RewriteEmailResult> {
  const provider = getProvider();
  const { system, user } = buildRewritePrompt(input.body, input.action);
  const raw = await provider.complete({
    systemPrompt: system,
    userPrompt: user,
    responseShape: "rewrite",
  });
  return parseRewriteResponse(raw);
}

export async function generateSubject(
  input: GenerateSubjectInput,
): Promise<GenerateSubjectResult> {
  const provider = getProvider();
  const { system, user } = buildGenerateSubjectPrompt(input);
  const raw = await provider.complete({
    systemPrompt: system,
    userPrompt: user,
    responseShape: "subject",
  });
  return parseGenerateSubjectResponse(raw);
}

export async function generateReply(
  input: GenerateReplyInput,
): Promise<GenerateReplyResult> {
  const provider = getProvider();
  const { system, user } = buildGenerateReplyPrompt(input);
  const raw = await provider.complete({
    systemPrompt: system,
    userPrompt: user,
    responseShape: "reply",
  });
  return parseGenerateReplyResponse(raw);
}

export async function summarizeEmail(
  input: SummarizeEmailInput,
): Promise<SummarizeEmailResult> {
  const provider = getProvider();
  const { system, user } = buildSummarizePrompt(input);
  const raw = await provider.complete({
    systemPrompt: system,
    userPrompt: user,
    responseShape: "summary",
  });
  return parseSummarizeResponse(raw);
}

export async function extractActionItems(
  input: ActionItemsInput,
): Promise<ActionItemsResult> {
  const provider = getProvider();
  const { system, user } = buildActionItemsPrompt(input);
  const raw = await provider.complete({
    systemPrompt: system,
    userPrompt: user,
    responseShape: "action-items",
  });
  return parseActionItemsResponse(raw);
}

export { AiError } from "./errors";
export type * from "./types";
