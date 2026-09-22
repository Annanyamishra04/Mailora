import type { EmailTemplate, NewEmailTemplate } from "@/lib/types";
import { TEMPLATES_CHANGED_EVENT, type TemplateStore } from "./template-types";

/**
 * LOCAL STORAGE STORE for custom templates — the unauthenticated fallback,
 * same role as `local-store.ts` plays for saved emails. Reachable only
 * before auth state resolves, or when Supabase isn't configured.
 */

const STORAGE_KEY = "ai-mail-studio:templates";

function isBrowser() {
  return typeof window !== "undefined";
}

function generateId(): string {
  if (isBrowser() && "randomUUID" in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(): EmailTemplate[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as EmailTemplate[];
  } catch {
    return [];
  }
}

function writeAll(templates: EmailTemplate[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new Event(TEMPLATES_CHANGED_EVENT));
  } catch {
    throw new Error("Couldn't save to this browser's storage.");
  }
}

async function getTemplates(): Promise<EmailTemplate[]> {
  return [...readAll()].sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
  );
}

async function saveTemplate(input: NewEmailTemplate): Promise<EmailTemplate> {
  const now = new Date().toISOString();
  const template: EmailTemplate = {
    ...input,
    id: generateId(),
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([template, ...readAll()]);
  return template;
}

async function updateTemplate(
  id: string,
  patch: Partial<NewEmailTemplate>,
): Promise<EmailTemplate | undefined> {
  const templates = readAll();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) return undefined;

  const updated: EmailTemplate = {
    ...templates[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  templates[index] = updated;
  writeAll(templates);
  return updated;
}

async function deleteTemplate(id: string): Promise<void> {
  writeAll(readAll().filter((t) => t.id !== id));
}

export const localTemplateStore: TemplateStore = {
  getTemplates,
  saveTemplate,
  updateTemplate,
  deleteTemplate,
};
