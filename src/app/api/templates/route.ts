import { withAuth } from "@/lib/api/guard";
import { describeError, jsonError, jsonOk } from "@/lib/api/response";
import { BODY_LIMITS, readJsonBody } from "@/lib/http";
import { validateCreateTemplateRequest } from "@/lib/validation/templates";
import {
  TEMPLATE_COLUMNS,
  TEMPLATES_LIST_LIMIT,
  rowToEmailTemplate,
  type TemplateRow,
} from "@/lib/storage/template-mappers";

/**
 * GET /api/templates — list the authenticated user's custom templates,
 * newest first. Built-in templates are never in this table — see
 * `lib/templates/builtin.ts` — so this route only ever returns
 * user-created ones.
 *
 * POST /api/templates — save a new custom template.
 *
 * Same security shape as `/api/emails`: `withAuth` (401 / rate limit /
 * CSRF), `user_id` derived from the session (never the request body), body
 * validated server-side, and Row Level Security as a second independent layer.
 */

export const GET = withAuth({ tag: "api/templates GET", limit: "none" }, async ({ user, supabase }) => {
  const { data, error } = await supabase
    .from("templates")
    .select(TEMPLATE_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(TEMPLATES_LIST_LIMIT + 1);

  if (error) {
    console.error(`[api/templates GET] ${describeError(error)}`);
    return jsonError(500, "Couldn't load your templates.");
  }

  const rows = data as unknown as TemplateRow[];
  const truncated = rows.length > TEMPLATES_LIST_LIMIT;
  const templates = rows.slice(0, TEMPLATES_LIST_LIMIT).map(rowToEmailTemplate);
  return jsonOk({ templates, truncated });
});

export const POST = withAuth({ tag: "api/templates POST", limit: "write" }, async ({ req, user, supabase }) => {
  const body = await readJsonBody(req, { maxBytes: BODY_LIMITS.template });
  if (!body.ok) return jsonError(body.status, body.error, { code: body.code });

  const validation = validateCreateTemplateRequest(body.data);
  if (!validation.valid) return jsonError(400, validation.error, { code: "invalid_request" });

  const input = validation.data;
  const { data, error } = await supabase
    .from("templates")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description ?? null,
      subject: input.subject,
      body: input.body,
      category: input.category,
      is_builtin: false,
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error || !data) {
    console.error(`[api/templates POST] ${describeError(error)}`);
    return jsonError(500, "Couldn't save that template.");
  }

  return jsonOk({ template: rowToEmailTemplate(data as unknown as TemplateRow) }, 201);
});
