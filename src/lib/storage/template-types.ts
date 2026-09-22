import type { EmailTemplate, NewEmailTemplate } from "@/lib/types";

/**
 * Common shape a persistence backend must implement for user-owned (custom)
 * templates. Mirrors `EmailStore` in `types.ts` — built-in templates never
 * go through this interface, they live in `lib/templates/builtin.ts` and
 * are merged in by the `useTemplates` hook.
 */
export interface TemplateStore {
  getTemplates(): Promise<EmailTemplate[]>;
  saveTemplate(input: NewEmailTemplate): Promise<EmailTemplate>;
  updateTemplate(
    id: string,
    patch: Partial<NewEmailTemplate>,
  ): Promise<EmailTemplate | undefined>;
  deleteTemplate(id: string): Promise<void>;
}

export const TEMPLATES_CHANGED_EVENT = "ai-mail-studio:templates-changed";
