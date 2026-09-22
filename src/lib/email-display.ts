import type { EmailType, SavedEmail } from "@/lib/types";

/**
 * Badge shown for a saved record's type. Shared between Compose, Reply, and
 * History so "Draft" / "Saved" / "Saved reply" always look the same.
 */
export const RECORD_TYPE_BADGE: Record<EmailType, { label: string; variant: "teal" | "gold" | "neutral" }> = {
  draft: { label: "Draft", variant: "gold" },
  generated: { label: "Saved", variant: "teal" },
  reply: { label: "Saved reply", variant: "teal" },
};

/**
 * Whether a saved record should be reopened in the Reply workspace rather
 * than Compose.
 *
 * `type: "reply"` records always go to Reply. A `type: "draft"` record is
 * ambiguous — both Compose and Reply save unfinished work as `"draft"` in
 * the same table (see README, "Known limitations": there's no separate
 * `origin` column) — so drafts started from Reply are recognized by the
 * heuristic Reply itself uses when saving: no recipient, and a purpose
 * that starts with "Reply" (set in `reply-workspace.tsx`). This can't be
 * fooled by a Compose draft with a real recipient, and a Compose draft
 * with no recipient would need a purpose starting with the literal word
 * "Reply" to be misrouted — an edge case, not a security or data issue
 * either way, since both pages can open and edit any saved record.
 */
export function isReplyOriginRecord(email: Pick<SavedEmail, "type" | "recipient" | "purpose">): boolean {
  if (email.type === "reply") return true;
  if (email.type === "draft" && !email.recipient.trim() && (email.purpose ?? "").startsWith("Reply")) {
    return true;
  }
  return false;
}

export function editHrefFor(email: Pick<SavedEmail, "id" | "type" | "recipient" | "purpose">): string {
  return isReplyOriginRecord(email) ? `/reply?id=${email.id}` : `/compose?id=${email.id}`;
}
