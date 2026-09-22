import type { EmailTemplate, TemplateCategory } from "@/lib/types";

/** Shape of a row in the `public.templates` table (see supabase/migrations). */
export interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  category: string;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_COLUMNS =
  "id,user_id,name,description,subject,body,category,is_builtin,created_at,updated_at";

/** Most recent custom templates returned by `GET /api/templates` (see `EMAILS_LIST_LIMIT`). */
export const TEMPLATES_LIST_LIMIT = 200;

export function rowToEmailTemplate(row: TemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    subject: row.subject ?? "",
    body: row.body ?? "",
    category: row.category as TemplateCategory,
    isBuiltin: row.is_builtin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
