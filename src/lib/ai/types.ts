import type { EmailLength, EmailTone } from "@/lib/types";

export interface GenerateEmailInput {
  recipient: string;
  purpose: string;
  tone: EmailTone;
  length: EmailLength;
  additionalInstructions?: string;
  signatureName?: string;
}

export interface GenerateEmailResult {
  subject: string;
  body: string;
}

export type RewriteAction =
  | "improve"
  | "polish"
  | "professional"
  | "formal"
  | "friendly"
  | "casual"
  | "apologetic"
  | "confident"
  | "shorten"
  | "expand"
  | "fix-grammar"
  | "make-clearer"
  | "make-persuasive";

export const REWRITE_ACTIONS: RewriteAction[] = [
  "improve",
  "polish",
  "professional",
  "formal",
  "friendly",
  "casual",
  "apologetic",
  "confident",
  "shorten",
  "expand",
  "fix-grammar",
  "make-clearer",
  "make-persuasive",
];

/** Tone-changing rewrite actions, for the "Change tone" menu specifically. */
export const TONE_REWRITE_ACTIONS: { action: RewriteAction; label: string }[] = [
  { action: "professional", label: "Professional" },
  { action: "formal", label: "Formal" },
  { action: "friendly", label: "Friendly" },
  { action: "casual", label: "Casual" },
  { action: "make-persuasive", label: "Persuasive" },
  { action: "apologetic", label: "Apologetic" },
  { action: "confident", label: "Confident" },
];

export interface RewriteEmailInput {
  body: string;
  action: RewriteAction;
}

export interface RewriteEmailResult {
  body: string;
}

export interface GenerateSubjectInput {
  body: string;
  purpose?: string;
}

export interface GenerateSubjectResult {
  subject: string;
}

/**
 * Reply generation reuses the same tone/length vocabulary as email
 * generation — both are just "write an email" requests with different
 * starting context (a blank purpose vs. an incoming message to respond to).
 */
export interface GenerateReplyInput {
  originalEmail: string;
  tone: EmailTone;
  length: EmailLength;
  instructions?: string;
}

export interface GenerateReplyResult {
  subject: string;
  body: string;
}

/** A single email summary — never invents a deadline that wasn't stated. */
export interface SummarizeEmailInput {
  email: string;
}

export interface SummarizeEmailResult {
  purpose: string;
  keyPoints: string[];
  requestedAction: string | null;
  deadline: string | null;
}

/** A single extracted action item. `owner`/`deadline` are null when not explicit. */
export interface ActionItem {
  task: string;
  owner: string | null;
  deadline: string | null;
}

export interface ActionItemsInput {
  email: string;
}

export interface ActionItemsResult {
  items: ActionItem[];
}

/**
 * What the AI service asks a provider adapter to do: produce raw text for a
 * given prompt pair. Prompt construction and response parsing/validation
 * live in `lib/ai` (shared across providers) — adapters only know how to
 * talk to one specific LLM API.
 */
export type AiResponseShape = "email" | "subject" | "rewrite" | "reply" | "summary" | "action-items";

export interface AiCompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  responseShape: AiResponseShape;
}

/**
 * Contract every provider adapter implements. Swapping providers means
 * writing one new file under `lib/ai/providers/` and pointing `provider.ts`
 * at it — nothing else in the app changes.
 */
export interface AiProviderAdapter {
  name: string;
  complete(request: AiCompletionRequest): Promise<string>;
}
