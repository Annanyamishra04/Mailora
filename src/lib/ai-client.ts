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
} from "@/lib/ai/types";
import { apiRequest } from "@/lib/api-client";

/**
 * Browser-side AI client. This is what compose UI components call — it
 * never touches an API key, it only talks to our own Next.js API routes,
 * which require a signed-in user and are the only place the real provider
 * (and its credentials) live. Failures surface as `ApiRequestError` with a
 * user-safe message (401 → session expired, 429 → wait, etc.).
 */

function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
  return apiRequest<TResponse>(url, { method: "POST", body: JSON.stringify(body) });
}

export function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailResult> {
  return postJson<GenerateEmailResult>("/api/ai/generate-email", input);
}

export function rewriteEmail(input: RewriteEmailInput): Promise<RewriteEmailResult> {
  return postJson<RewriteEmailResult>("/api/ai/rewrite", input);
}

export function generateSubject(input: GenerateSubjectInput): Promise<GenerateSubjectResult> {
  return postJson<GenerateSubjectResult>("/api/ai/generate-subject", input);
}

export function generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
  return postJson<GenerateReplyResult>("/api/ai/generate-reply", input);
}

export function summarizeEmail(input: SummarizeEmailInput): Promise<SummarizeEmailResult> {
  return postJson<SummarizeEmailResult>("/api/ai/summarize-email", input);
}

export function extractActionItems(input: ActionItemsInput): Promise<ActionItemsResult> {
  return postJson<ActionItemsResult>("/api/ai/action-items", input);
}
