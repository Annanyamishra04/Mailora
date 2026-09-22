/**
 * Shared domain types for AI Mail Studio.
 *
 * These types are provider-agnostic on purpose: the same `SavedEmail`,
 * `EmailTone`, and `EmailLength` shapes are used whether the data comes
 * from localStorage (Phase 1) or Supabase (a later phase), and whether a
 * draft comes from the AI provider configured in `lib/ai` or, in the
 * future, another source entirely.
 */

export type EmailTone =
  | "professional"
  | "formal"
  | "friendly"
  | "casual"
  | "persuasive"
  | "apologetic"
  | "confident";

export type EmailLength = "short" | "medium" | "detailed";

/** How a saved email originated — mirrors the `type` column in Supabase. */
export type EmailType = "generated" | "reply" | "draft";

export const EMAIL_TONES: { value: EmailTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "persuasive", label: "Persuasive" },
  { value: "apologetic", label: "Apologetic" },
  { value: "confident", label: "Confident" },
];

export const EMAIL_LENGTHS: { value: EmailLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "detailed", label: "Detailed" },
];

/** A saved draft, persisted through the storage abstraction. */
export interface SavedEmail {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  tone: EmailTone;
  length: EmailLength;
  /** The natural-language purpose used to generate this draft, if any. */
  purpose?: string;
  /** Additional instructions supplied alongside the purpose, if any (Compose drafts). */
  additionalInstructions?: string;
  /** Where this record came from — the Compose flow, Reply, or a manual draft. */
  type: EmailType;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields needed to create a new saved email. */
export type NewSavedEmail = Omit<
  SavedEmail,
  "id" | "createdAt" | "updatedAt" | "favorite" | "type"
> & { favorite?: boolean; type?: EmailType };

/** Frontend-only writing preferences (Phase 1: local, not tied to an account). */
export interface WritingPreferences {
  defaultTone: EmailTone;
  defaultLength: EmailLength;
  autoSignOff: boolean;
  signatureName: string;
}

/**
 * Email templates (Phase 5).
 *
 * Built-in templates ship in application code (see `lib/templates/builtin.ts`)
 * rather than the database — they're the same for every user and never
 * change at runtime, so a database round-trip would be pure overhead.
 * User-created templates are persisted through the storage abstraction,
 * the same way saved emails are (`lib/storage/template-*`).
 */
export type TemplateCategory =
  | "job-application"
  | "follow-up"
  | "meeting-request"
  | "thank-you"
  | "leave-request"
  | "networking"
  | "internship-inquiry"
  | "project-update"
  | "other";

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "job-application", label: "Job Application" },
  { value: "follow-up", label: "Follow-up" },
  { value: "meeting-request", label: "Meeting Request" },
  { value: "thank-you", label: "Thank You" },
  { value: "leave-request", label: "Leave Request" },
  { value: "networking", label: "Networking" },
  { value: "internship-inquiry", label: "Internship Inquiry" },
  { value: "project-update", label: "Project Update" },
  { value: "other", label: "Other" },
];

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  /** True for the static, app-provided templates in `lib/templates/builtin.ts`. */
  isBuiltin: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Fields needed to create a new user-owned template. */
export type NewEmailTemplate = Omit<
  EmailTemplate,
  "id" | "createdAt" | "updatedAt" | "isBuiltin"
>;
