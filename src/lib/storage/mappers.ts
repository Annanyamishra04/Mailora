import type { EmailLength, EmailTone, EmailType, SavedEmail } from "@/lib/types";

/** Shape of a row in the `public.emails` table (see supabase/migrations). */
export interface EmailRow {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  recipient: string;
  tone: string;
  length: string;
  type: string;
  purpose: string | null;
  additional_instructions: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

/** Explicit column list (rather than `*`) so a future column can't leak into responses by accident. */
export const EMAIL_COLUMNS =
  "id,user_id,subject,body,recipient,tone,length,type,purpose,additional_instructions,is_favorite,created_at,updated_at";

/**
 * Most recent emails returned by `GET /api/emails`. History, search and the
 * dashboard work on the loaded list in the browser, so it has to be bounded:
 * an unbounded list eventually exceeds serverless response-size limits
 * (~4.5 MB on Vercel) and makes every page load slower for power users.
 */
export const EMAILS_LIST_LIMIT = 500;

export function rowToSavedEmail(row: EmailRow): SavedEmail {
  return {
    id: row.id,
    recipient: row.recipient ?? "",
    subject: row.subject ?? "",
    body: row.body ?? "",
    tone: row.tone as EmailTone,
    length: row.length as EmailLength,
    type: row.type as EmailType,
    purpose: row.purpose ?? undefined,
    additionalInstructions: row.additional_instructions ?? undefined,
    favorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
