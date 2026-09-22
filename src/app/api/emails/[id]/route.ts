import { withAuth } from "@/lib/api/guard";
import { describeError, jsonError, jsonOk } from "@/lib/api/response";
import { BODY_LIMITS, readJsonBody } from "@/lib/http";
import { isUuid } from "@/lib/validation/common";
import { validateUpdateEmailRequest } from "@/lib/validation/emails";
import { EMAIL_COLUMNS, rowToSavedEmail, type EmailRow } from "@/lib/storage/mappers";

type Params = { id: string };

const NOT_FOUND = "That email wasn't found.";

/**
 * PATCH /api/emails/[id] — partially update one of the authenticated
 * user's saved emails. DELETE /api/emails/[id] — remove it.
 *
 * Ownership is enforced twice, deliberately: an explicit
 * `.eq("user_id", user.id)` here (so a wrong or missing row is reported as
 * "not found" rather than leaking whether another user's row exists), and
 * Row Level Security on the `emails` table as a second, independent layer.
 * Neither the update nor the delete can affect a row that isn't the
 * caller's, no matter what `id` is supplied. A malformed id is reported
 * exactly like a missing one (404) — it can't exist, and Postgres would
 * otherwise raise a uuid syntax error.
 */

export const PATCH = withAuth<Params>(
  { tag: "api/emails/:id PATCH", limit: "write" },
  async ({ req, params, user, supabase }) => {
    if (!isUuid(params.id)) return jsonError(404, NOT_FOUND);

    const body = await readJsonBody(req, { maxBytes: BODY_LIMITS.email });
    if (!body.ok) return jsonError(body.status, body.error, { code: body.code });

    const validation = validateUpdateEmailRequest(body.data);
    if (!validation.valid) return jsonError(400, validation.error, { code: "invalid_request" });

    // Key-presence (not `!== undefined`) so sending "" really clears an
    // optional field: the validator maps "" → undefined for these.
    const patch = validation.data;
    const update: Record<string, unknown> = {};
    if ("recipient" in patch) update.recipient = patch.recipient ?? "";
    if ("subject" in patch) update.subject = patch.subject ?? "";
    if ("body" in patch) update.body = patch.body ?? "";
    if ("purpose" in patch) update.purpose = patch.purpose ?? null;
    if ("additionalInstructions" in patch) {
      update.additional_instructions = patch.additionalInstructions ?? null;
    }
    if (patch.tone !== undefined) update.tone = patch.tone;
    if (patch.length !== undefined) update.length = patch.length;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.favorite !== undefined) update.is_favorite = patch.favorite;

    const { data, error } = await supabase
      .from("emails")
      .update(update)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select(EMAIL_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error(`[api/emails/:id PATCH] ${describeError(error)}`);
      return jsonError(500, "Couldn't update that email.");
    }

    if (!data) return jsonError(404, NOT_FOUND);

    return jsonOk({ email: rowToSavedEmail(data as unknown as EmailRow) });
  },
);

export const DELETE = withAuth<Params>(
  { tag: "api/emails/:id DELETE", limit: "write" },
  async ({ params, user, supabase }) => {
    if (!isUuid(params.id)) return jsonError(404, NOT_FOUND);

    const { data, error } = await supabase
      .from("emails")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(`[api/emails/:id DELETE] ${describeError(error)}`);
      return jsonError(500, "Couldn't delete that email.");
    }

    if (!data) return jsonError(404, NOT_FOUND);

    return jsonOk({ deleted: true });
  },
);
