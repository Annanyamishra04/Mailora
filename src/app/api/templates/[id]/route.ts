import { withAuth } from "@/lib/api/guard";
import { describeError, jsonError, jsonOk } from "@/lib/api/response";
import { BODY_LIMITS, readJsonBody } from "@/lib/http";
import { isUuid } from "@/lib/validation/common";
import { validateUpdateTemplateRequest } from "@/lib/validation/templates";
import {
  TEMPLATE_COLUMNS,
  rowToEmailTemplate,
  type TemplateRow,
} from "@/lib/storage/template-mappers";

type Params = { id: string };

const NOT_FOUND = "That template wasn't found.";

/**
 * PATCH /api/templates/[id] — partially update one of the authenticated
 * user's custom templates. DELETE /api/templates/[id] — remove it.
 *
 * Ownership is enforced twice, deliberately, exactly as in
 * `/api/emails/[id]`: an explicit `.eq("user_id", user.id)` here, and Row
 * Level Security on `public.templates` as a second, independent layer.
 * Built-in templates never reach this route at all — they aren't rows in
 * this table, so there's nothing here for a client to attempt to edit or
 * delete.
 */

export const PATCH = withAuth<Params>(
  { tag: "api/templates/:id PATCH", limit: "write" },
  async ({ req, params, user, supabase }) => {
    if (!isUuid(params.id)) return jsonError(404, NOT_FOUND);

    const body = await readJsonBody(req, { maxBytes: BODY_LIMITS.template });
    if (!body.ok) return jsonError(body.status, body.error, { code: body.code });

    const validation = validateUpdateTemplateRequest(body.data);
    if (!validation.valid) return jsonError(400, validation.error, { code: "invalid_request" });

    // Key-presence so clearing the optional description ("" → undefined
    // in the validator) is actually written as NULL.
    const patch = validation.data;
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if ("description" in patch) update.description = patch.description ?? null;
    if (patch.subject !== undefined) update.subject = patch.subject;
    if (patch.body !== undefined) update.body = patch.body;
    if (patch.category !== undefined) update.category = patch.category;

    const { data, error } = await supabase
      .from("templates")
      .update(update)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select(TEMPLATE_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error(`[api/templates/:id PATCH] ${describeError(error)}`);
      return jsonError(500, "Couldn't update that template.");
    }

    if (!data) return jsonError(404, NOT_FOUND);

    return jsonOk({ template: rowToEmailTemplate(data as unknown as TemplateRow) });
  },
);

export const DELETE = withAuth<Params>(
  { tag: "api/templates/:id DELETE", limit: "write" },
  async ({ params, user, supabase }) => {
    if (!isUuid(params.id)) return jsonError(404, NOT_FOUND);

    const { data, error } = await supabase
      .from("templates")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(`[api/templates/:id DELETE] ${describeError(error)}`);
      return jsonError(500, "Couldn't delete that template.");
    }

    if (!data) return jsonError(404, NOT_FOUND);

    return jsonOk({ deleted: true });
  },
);
