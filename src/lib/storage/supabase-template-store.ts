import { apiRequest } from "@/lib/api-client";
import type { EmailTemplate, NewEmailTemplate } from "@/lib/types";
import type { TemplateStore } from "./template-types";

/**
 * SUPABASE-BACKED TEMPLATE STORE.
 *
 * Talks only to this app's own `/api/templates` routes — never to Supabase
 * directly from the browser for writes — so the server can verify the
 * session and derive `user_id` itself. Mirrors `supabase-store.ts`.
 */

interface TemplatesListResponse {
  templates: EmailTemplate[];
}

interface TemplateResponse {
  template: EmailTemplate;
}

function request<T>(url: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(url, init);
}

async function getTemplates(): Promise<EmailTemplate[]> {
  const { templates } = await request<TemplatesListResponse>("/api/templates", { method: "GET" });
  return templates;
}

async function saveTemplate(input: NewEmailTemplate): Promise<EmailTemplate> {
  const { template } = await request<TemplateResponse>("/api/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return template;
}

async function updateTemplate(
  id: string,
  patch: Partial<NewEmailTemplate>,
): Promise<EmailTemplate | undefined> {
  const { template } = await request<TemplateResponse>(`/api/templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return template;
}

async function deleteTemplate(id: string): Promise<void> {
  await request<{ deleted: true }>(`/api/templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export const supabaseTemplateStore: TemplateStore = {
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
};
