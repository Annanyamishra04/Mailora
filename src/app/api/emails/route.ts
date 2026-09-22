import { withAuth } from "@/lib/api/guard";
import { describeError, jsonError, jsonOk } from "@/lib/api/response";
import { BODY_LIMITS, readJsonBody } from "@/lib/http";
import { validateCreateEmailRequest } from "@/lib/validation/emails";
import {
  EMAIL_COLUMNS,
  EMAILS_LIST_LIMIT,
  rowToSavedEmail,
  type EmailRow,
} from "@/lib/storage/mappers";

/**
 * GET /api/emails — list the authenticated user's saved emails, newest
 * first (most recent EMAILS_LIST_LIMIT). POST /api/emails — save a new one.
 *
 * Every operation here goes through `withAuth`, which:
 *   1. rejects unauthenticated requests with 401 (JSON, never a redirect),
 *   2. rate limits and CSRF-checks state-changing calls.
 * On top of that each handler:
 *   3. derives `user_id` from the verified session — the body's `user_id`
 *      (or any unknown field) is rejected by validation, never read,
 *   4. filters by `.eq("user_id", user.id)`, and
 *   5. runs through the session-scoped Supabase client, so Row Level
 *      Security applies even if a filter were ever accidentally dropped.
 */

export const GET = withAuth({ tag: "api/emails GET", limit: "none" }, async ({ user, supabase }) => {
  const { data, error } = await supabase
    .from("emails")
    .select(EMAIL_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(EMAILS_LIST_LIMIT + 1);

  if (error) {
    console.error(`[api/emails GET] ${describeError(error)}`);
    return jsonError(500, "Couldn't load your saved emails.");
  }

  const rows = data as unknown as EmailRow[];
  const truncated = rows.length > EMAILS_LIST_LIMIT;
  const emails = rows.slice(0, EMAILS_LIST_LIMIT).map(rowToSavedEmail);
  return jsonOk({ emails, truncated });
});

export const POST = withAuth({ tag: "api/emails POST", limit: "write" }, async ({ req, user, supabase }) => {
  const body = await readJsonBody(req, { maxBytes: BODY_LIMITS.email });
  if (!body.ok) return jsonError(body.status, body.error, { code: body.code });

  const validation = validateCreateEmailRequest(body.data);
  if (!validation.valid) return jsonError(400, validation.error, { code: "invalid_request" });

  const input = validation.data;
  const { data, error } = await supabase
    .from("emails")
    .insert({
      user_id: user.id,
      subject: input.subject,
      body: input.body,
      recipient: input.recipient,
      tone: input.tone,
      length: input.length,
      type: input.type ?? "generated",
      purpose: input.purpose ?? null,
      additional_instructions: input.additionalInstructions ?? null,
      is_favorite: input.favorite ?? false,
    })
    .select(EMAIL_COLUMNS)
    .single();

  if (error || !data) {
    console.error(`[api/emails POST] ${describeError(error)}`);
    return jsonError(500, "Couldn't save that email.");
  }

  return jsonOk({ email: rowToSavedEmail(data as unknown as EmailRow) }, 201);
});
