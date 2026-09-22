# AI Mail Studio

An AI-powered email writing tool — describe what you need to say, pick a tone and length, and get a draft you can edit, rewrite, save, and reuse. Also generates replies to emails you've received, via a dedicated Reply workspace. Drafts and replies are saved to a real account, backed by Supabase. As of Phase 5, the app also has proper draft management with autosave, a reusable template library, richer History filtering, and two real AI actions (Summarize, Extract action items) alongside the existing generation/rewrite/reply flows. **Phase 6 is a production-hardening pass** — see [Production readiness](#production-readiness-phase-6).

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Radix-based UI primitives · next-themes · Supabase (Auth + Postgres)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase configured, `/`, `/login`, and `/signup` still render, but every authenticated route (`/dashboard`, `/compose`, `/reply`, `/templates`, `/history`, `/settings`) and the auth forms will show a clear "Supabase isn't configured" message rather than faking a signed-in state. **As of Phase 6 every `/api/ai/*` route also requires a signed-in user, so the AI features need a working Supabase project too** — there is no anonymous AI access.

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com) (the free tier is enough for development).
2. **Get your API keys.** In the dashboard, go to Project Settings → API and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (not used by any route in this phase — see `src/lib/supabase/admin.ts` — but scaffolded for later privileged operations. Keep it out of the browser regardless.)
3. **Run the schema.** Open the SQL Editor in the dashboard and run these four files, **in order**, once each (they're idempotent, so re-running any of them is safe):
   - [`supabase/migrations/0001_emails.sql`](./supabase/migrations/0001_emails.sql) — the `emails` table, indexes, an `updated_at` trigger, and Row Level Security policies.
   - [`supabase/migrations/0002_emails_additional_instructions.sql`](./supabase/migrations/0002_emails_additional_instructions.sql) — **(Phase 5)** adds the `additional_instructions` column so a saved draft can fully round-trip Compose's "additional instructions" field, not just recipient/subject/body/tone/length.
   - [`supabase/migrations/0003_templates.sql`](./supabase/migrations/0003_templates.sql) — **(Phase 5)** creates the `templates` table (user-owned custom templates only — built-in starter templates live in code, see below) with its own RLS policies.

   - [`supabase/migrations/0004_hardening.sql`](./supabase/migrations/0004_hardening.sql) — **(Phase 6)** database-level defense in depth: `CHECK` constraints mirroring the API's length/enum limits (so a signed-in user can't bypass the API's validation by calling PostgREST directly with the public anon key), the `(select auth.uid())` RLS performance form, and a pinned `search_path` on the trigger function. Constraints are added `NOT VALID`, so they apply to every new write without scanning (or failing on) existing rows. If you ever re-run `0001`, re-run `0004` afterwards.

   If you use the Supabase CLI instead, `supabase db push` picks up all four files from `supabase/migrations/` in filename order.
4. **Enable email/password auth.** In Authentication → Providers, make sure "Email" is enabled (it is by default). In Authentication → Settings, decide whether to require email confirmation:
   - **Confirmation required (default, recommended for anything beyond local dev):** after signing up, a person must click the link Supabase emails them before they can log in. The signup page detects this and shows a "check your email" message instead of pretending they're signed in.
   - **Confirmation disabled (handy for local development):** turn off "Enable email confirmations" for the project, and signup logs the person in immediately.
5. **(Optional, recommended) Let confirmation emails sign people in.** Under Authentication → URL Configuration, set **Site URL** to your deployed URL and add `<your-site>/auth/callback` (and `http://localhost:3000/auth/callback` for development) to **Redirect URLs**. Signup links then land on `/auth/callback`, which exchanges the one-time code for a session so the person arrives signed in. Until you add it, Supabase ignores the redirect and falls back to the Site URL — nothing breaks, the person just logs in manually after confirming. If the link is opened on a different device from the one that signed up, the exchange can't complete and they're sent to `/login` with a notice (their email is still confirmed).
6. **Add the keys to `.env.local`** (see `.env.example`) and restart `npm run dev`.

### Local development without Supabase configured

The app doesn't require Supabase to boot. The marketing page and auth pages render either way; anything that needs a session (protected routes, sign in/up) will show a setup message instead of erroring or faking success until the environment variables above are set. AI routes fail closed with a `503` ("this deployment isn't fully configured") rather than running unauthenticated.

## AI provider setup

Email generation, reply generation, rewriting, subject suggestions, and (as of Phase 5) summarizing/action-item extraction all call Google's Gemini API through this app's own server-side API routes (`src/app/api/ai/*`) — the browser never sees an API key.

1. Get a free development API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Add it to `.env.local` as `GEMINI_API_KEY`.
3. Set `GEMINI_MODEL` explicitly. **Google retires models regularly — `gemini-2.0-flash`, the default in Phases 2–5, was shut down on 2026-06-01 and fails every request.** The built-in fallback is now `gemini-3.5-flash`; confirm the current name at [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models). If a model is retired, the API returns a generic "AI features are temporarily unavailable" to users and, in development, a message naming the model to change.
4. Restart `npm run dev`.

See `.env.example` for all supported environment variables.

## Features

- **Sign up / log in** (`/signup`, `/login`) — email/password accounts via Supabase Auth, with human-readable error messages, loading states, and correct handling of Supabase's email-confirmation setting.
- **Compose** (`/compose`) — describe an email, generate a draft, then rewrite it (Polish, Change tone [Professional/Formal/Friendly/Casual/Persuasive/Apologetic/Confident], Shorten, Expand, Fix grammar, Make clearer), regenerate the subject, and save it to History. **(Phase 5)** Save Draft / Update Draft / Delete Draft, a debounced autosave that quietly keeps an in-progress draft up to date (see "Autosave," below), and starting from a template via `/compose?template=<id>`.
- **Reply** (`/reply`) — paste an email you received, choose a tone and length, and generate a suggested subject + reply body. Regenerate as needed, edit freely, copy, or save to History. **(Phase 5)** The same rewrite toolbar as Compose (Polish/Change tone/Shorten/Expand/Fix grammar/Make clearer), a Generate Subject action, Save Draft/Update Draft/Delete Draft, and an **Analyze** menu that summarizes the pasted email or extracts its action items via real AI calls. Nothing is ever sent automatically — this app only drafts.
- **Templates** (`/templates`) — **(Phase 5)** eight built-in starter templates (Job Application, Follow-up, Meeting Request, Thank You, Leave Request, Networking, Internship Inquiry, Project Update) plus your own custom templates. Search, filter by category, preview, "Use" (opens Compose pre-filled), and create/edit/delete your own. Built-in templates can't be edited or deleted.
- **History** (`/history`) — saved drafts, replies, and generated emails, searchable (subject/body/recipient) and favoritable, persisted per-account in Postgres. **(Phase 5)** Filter by type (All/Generated/Reply/Draft), favorite status, and an optional date range; sort newest/oldest first; filters collapse into a single dialog on narrow screens.
- **Dashboard** (`/dashboard`) — recent activity, favorites, and real counts pulled from your saved emails. **(Phase 5)** A "Continue a draft" section, a Templates quick-access section, a Quick Reply shortcut, and an expanded stats row (saved emails, drafts, replies, favorited, created this week) — every number computed from your actual data, nothing fabricated.
- **Settings** (`/settings`) — account email/name, sign out, and writing preference defaults (tone, length, sign-off).

All authenticated routes are protected: signed-out visitors are redirected to `/login`, and signed-in visitors are redirected away from `/login`/`/signup` — see `src/proxy.ts`.

### Draft system (Phase 5)

A draft captures recipient, subject, body, tone, length, and additional instructions — everything needed to fully restore a Compose session. Drafts are ordinary rows in the existing `emails` table with `type = "draft"` (no second table), so History, Dashboard, and search all treat them like any other saved email; the UI just tags them with a "Draft" badge and routes them back to an editable Compose/Reply session with `?id=`.

**Autosave.** Once you've typed something meaningful into Compose, autosave kicks in after 2.5 seconds of no typing and quietly saves (or updates) a `type: "draft"` row — never interrupting the keystroke, never creating a second row for the same in-progress email, and never touching a record you've already finalized with "Save to history" (autosave only ever writes to `type: "draft"` rows; once a record is saved as `"generated"`, autosave leaves it alone). A small status indicator next to the word count shows "Saving draft…", "Draft saved", or "Unable to save draft". This was a deliberate, bounded implementation rather than a save-on-every-keystroke approach: it's debounced, and skips entirely when nothing has actually changed since the last save (snapshot-diffed). **(Phase 6)** Every write for the draft on screen — autosave, Save Draft, Save to history, favorite, delete — now goes through one serialized controller, `DraftSync` (`src/lib/drafts/draft-sync.ts`), instead of an in-flight flag. That closes several ways Phase 5 could lose or duplicate work: an edit made while a save was in flight is now always written afterwards; Save Draft during the first autosave can't create a second record; autosave can't demote a record you just saved to History; starting a new draft can't inherit the old record's id; and a deleted draft can't be resurrected by a queued autosave. The last few seconds of typing are also flushed when you click New draft or navigate away, failed autosaves retry on their own (except when retrying can't help, e.g. a signed-out session), and closing the tab with unsaved changes asks for confirmation. Each of those scenarios is a test in `tests/draft-sync.test.ts`. Reply has the same "Save Draft" affordance and status indicator, but saves only on an explicit click rather than on an idle timer — see "Known limitations" for why the two workspaces aren't fully symmetric here. (Reply's manual saves use the same `DraftSync`, so Save and Save Draft can't race into duplicates.)

## Architecture notes

- `src/lib/ai/` — server-only AI service: prompt construction (`prompts.ts`), the provider adapter interface (`types.ts`), the active provider resolver (`provider.ts`), the Gemini adapter (`providers/gemini.ts`), and response parsing/validation (`parse.ts`). **(Phase 5)** Extended with `summarizeEmail`/`extractActionItems` (in `index.ts`), their prompts (strict "never invent a deadline/owner" instructions), and defensive parsers that reject malformed AI JSON rather than trusting it blindly. Also extended `RewriteAction` with `polish`, `formal`, `casual`, `apologetic`, `confident` (on top of the existing actions) and a `TONE_REWRITE_ACTIONS` list used to build the "Change tone" menu.
- `src/lib/ai-client.ts` — the only AI-related module client components import; calls this app's own `/api/ai/*` routes. **(Phase 5)** Adds `summarizeEmail`/`extractActionItems`.
- `src/lib/supabase/` — the Supabase client boundary:
  - `client.ts` — browser client (cookie-backed session), used by auth pages, `use-auth.tsx`, and sign-out.
  - `server.ts` — session-aware server client for Server Components and Route Handlers, subject to RLS.
  - `admin.ts` — service-role client. Not imported by any route today; exists as scaffolding for a genuinely privileged operation in a later phase.
  - `auth.ts` — `getAuthenticatedContext()` / `getAuthenticatedUser()`, the single place a session is verified and a trustworthy user id obtained. **(Phase 6)** It distinguishes "not signed in" (`null`) from "couldn't check" (throws, e.g. Supabase Auth is down), so an outage answers 503 rather than a misleading 401.
  - `auth-errors.ts` — maps raw Supabase errors to messages safe to show a user.
  - `errors.ts` — `SupabaseConfigError`, thrown when env vars are missing, so "not configured" is a distinct, handleable case rather than a generic crash.
- `src/proxy.ts` — refreshes the Supabase session and protects `/dashboard`, `/compose`, `/reply`, `/templates`, `/history`, `/settings` (route lists live in `src/lib/routes.ts`, shared with the client). **(Phase 6)** It skips the Supabase round trip for public pages, fails closed if Supabase Auth is unreachable, copies refreshed session cookies onto redirects, and only honours same-origin `redirectTo` values (`safeRedirectPath`) — a crafted `?redirectTo=https://…` used to be an open redirect. API routes are deliberately never redirected: they answer 401 JSON themselves.
- `src/hooks/use-auth.tsx` — `AuthProvider`/`useAuth`, a small client-side context so components can read the current user without prop-drilling. Route protection itself lives in `proxy.ts`, not here. **(Phase 6)** It also owns the "your session ended while this page was open" case: a `SIGNED_OUT` event or an API `401` shows a persistent banner with a log-in link rather than redirecting, so text you were typing isn't destroyed.
- `src/lib/storage/` — persistence abstraction, backend-agnostic and async:
  - `local-store.ts` / `supabase-store.ts` — the two `EmailStore` backends (localStorage fallback; `/api/emails`-backed).
  - `index.ts` — `getEmailStore(isAuthenticated)` and **(Phase 5)** `getTemplateStore(isAuthenticated)` each pick a backend; `use-emails.ts`/`use-templates.ts` are the only callers.
  - `mappers.ts` — converts between the Postgres `emails` row shape (snake_case) and the app's `SavedEmail` type.
  - **(Phase 5)** `template-types.ts`, `local-template-store.ts`, `supabase-template-store.ts`, `template-mappers.ts` — the same pattern, one level down, for user-owned custom templates.
- `src/lib/templates/builtin.ts` — **(Phase 5)** the eight static starter templates. Deliberately in code, not the database: they're identical for every user and never change at runtime, so a table (or a per-user copy) would be pure overhead. See `supabase/migrations/0003_templates.sql`'s header comment for the same reasoning inline with the schema.
- `src/lib/email-display.ts` — **(Phase 5)** shared "how do we show/route a saved record" helpers (`RECORD_TYPE_BADGE`, `editHrefFor`, `isReplyOriginRecord`) used by Compose, Reply, History, and Dashboard so a Draft/Saved/Saved-reply badge and edit link always mean the same thing everywhere. See "Known limitations" below for the one heuristic this file documents.
- `src/app/api/emails/` — `GET`/`POST /api/emails` and `PATCH`/`DELETE /api/emails/[id]`. Every route verifies the session, derives `user_id` from it (never from the request body), validates the body (`src/lib/validation/emails.ts`), and relies on Postgres Row Level Security as a second, independent enforcement layer.
- `src/app/api/templates/` — **(Phase 5)** `GET`/`POST /api/templates` and `PATCH`/`DELETE /api/templates/[id]`, same security shape as `/api/emails` (session-derived `user_id`, server-side validation in `src/lib/validation/templates.ts`, RLS as a second layer). Built-in templates are never rows here, so there's nothing for these routes to accidentally expose or let someone edit.
- `src/app/api/ai/*` — six routes (`generate-email`, `generate-subject`, `rewrite`, `generate-reply`, `summarize-email`, `action-items`), each a few lines built on `createAiRoute` (`src/lib/api/ai-route.ts`). **(Phase 6)** All require a signed-in user and are rate limited; see below.
- `src/lib/api/` — **(Phase 6)** the shared API layer. `guard.ts` (`withAuth`) is the single entry point for every authenticated route: per-IP limit → CSRF check → session check (401) → per-user rate limit (429) → handler, with any unexpected exception turned into a generic 500. `response.ts` gives every route one error shape, `{ error, code }`, plus `Cache-Control: no-store`. `limits.ts` configures the limiters from env vars. New routes should use `withAuth`; a route that doesn't is visibly unprotected in review.
- `src/lib/http.ts` — **(Phase 6)** `readJsonBody` (byte-limited streaming read, JSON `Content-Type` required, strict UTF-8), `isCrossSiteRequest`, `getClientIp`. `src/lib/rate-limit.ts` — the sliding-window limiter. `src/lib/env.ts` + `src/instrumentation.ts` — environment inspection that logs problems by variable *name* at server start and never crashes the build.
- `supabase/migrations/0001_emails.sql` — the `emails` table, indexes, `updated_at` trigger, and RLS policies. **(Phase 5)** `0002_emails_additional_instructions.sql` adds one column; `0003_templates.sql` adds the `templates` table + RLS. **(Phase 6)** `0004_hardening.sql` — constraints and RLS/function hygiene (see Supabase setup).
- `src/lib/validation/` — client-side form validation (`email.ts`, `reply.ts`) and server-side request validation (`ai.ts`, `emails.ts`, and **(Phase 5)** `templates.ts`); the server never trusts the client's checks alone. **(Phase 6)** The three server validators share `common.ts`; unknown fields (including a smuggled `user_id`) are rejected, as are NUL characters and lone surrogates that Postgres can't store, and row ids must be UUIDs.
- `src/components/shared/rewrite-toolbar.tsx` — **(Phase 5)** moved here from `components/compose/` and redesigned (Polish button + "Change tone" menu + Shorten/Expand/Fix grammar/Make clearer) so Compose and Reply share one implementation instead of two diverging ones.
- `src/components/layout/user-menu.tsx` — the sidebar's real account identity + sign-out, the one client-side piece of `AppShell`.

## Known limitations

- **Reply doesn't have idle-timer autosave, only manual Save Draft.** Compose's autosave was scoped carefully (see above) to avoid race conditions; extending the identical debounced-effect approach to Reply as well was judged to add a second copy of that surface without a clear need — Reply sessions are typically shorter (paste → generate → send), and Save Draft/Update Draft cover the "I need to step away" case. If idle-loss in Reply turns out to matter in practice, the fix is mechanical: port the same debounced `useEffect` pattern from `compose-workspace.tsx`.
- **Reply-origin drafts are recognized by a heuristic, not a database column.** Both Compose and Reply save unfinished work as `type: "draft"` in the same `emails` table (per this phase's instructions, no second table and no schema explosion). To route a saved draft back to the right workspace, `isReplyOriginRecord()` (`src/lib/email-display.ts`) checks whether the record has no recipient and a purpose starting with "Reply" — which is how Reply itself saves a draft. This can't misfire for a normal Compose draft with a real recipient, and the one contrived edge case (a Compose draft with no recipient whose purpose happens to start with the literal word "Reply") is cosmetic, not a data or security issue — either workspace can open and correctly edit any saved record regardless of which one it opens in.
- **Reopening a saved reply doesn't restore the original email text.** Only the generated subject/body/tone/length round-trip (plus a short truncated preview of the original, stored in `purpose`, used only for display and for the heuristic above) — the full original email you pasted in isn't persisted separately. Regenerating after reopening a saved reply requires re-pasting the original.
- **History filtering/search is client-side.** (**Phase 6:** the list is capped at the newest 500 emails / 200 custom templates, and the response carries `truncated: true` when older items exist — an unbounded list eventually exceeds serverless response-size limits. The UI does not yet surface the `truncated` flag or paginate.) The full list of a user's saved emails is already fetched (existing Phase 4 architecture, unchanged), so type/favorite/date filtering, sorting, and search all run against that already-fetched, already-user-scoped list rather than adding query parameters to `GET /api/emails`. This keeps the change surface small and is fine at the scale a personal email tool's history reaches; if that stops being true, the natural next step is `GET /api/emails?type=&favorite=&q=` with the same server-side scoping the route already has.

## Production readiness (Phase 6)

### Security

- **Row Level Security** is enabled on `emails` and `templates`, with owner-only policies for select/insert/update/delete and no "read everything" policy. `0004_hardening.sql` adds `CHECK` constraints so a signed-in user can't sidestep the API's validation by calling PostgREST directly with the public anon key.
- **Server-side authentication.** Every API route goes through `withAuth` (`src/lib/api/guard.ts`), which verifies the session with `auth.getUser()` (re-validated against Supabase Auth, not just read from the cookie). Unauthenticated requests get a JSON `401` — never an HTML redirect — before any body is read, database query made, or AI call issued. `user_id` always comes from the session; a `user_id` in a request body is rejected.
- **AI API authentication.** All six `/api/ai/*` routes require a signed-in user. Gemini is contacted only after authentication, rate limiting, and validation have all passed.
- **Gemini key stays server-side.** `GEMINI_API_KEY` is read only in `src/lib/ai/providers/gemini.ts` (`server-only`), sent in the `x-goog-api-key` header rather than the URL, and never included in a response or log. `npm run check:bundle` scans the built client output for it.
- **Validation.** Bodies are read with a hard byte limit (streamed, so an oversized body is abandoned early), must be `application/json`, and are validated strictly: string and array lengths, enum values, UUID ids, and unknown fields are all rejected. AI output is treated as untrusted too: size-capped, stripped of characters Postgres can't store, never parsed from truncated JSON, and rendered only as plain text (nothing in the app uses `dangerouslySetInnerHTML`). Pasted text is fenced in the prompts so it can't close its own quotation block.
- **CSRF defense in depth.** Session cookies are `SameSite=Lax`; JSON `Content-Type` is required (a cross-site form can't send it); and state-changing requests carrying a cross-site `Origin`/`Sec-Fetch-Site` are refused with `403`.
- **Rate limiting** — see below.
- **Security headers** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cache-Control: no-store` on `/api/*`, and in production `Strict-Transport-Security` and a **Content-Security-Policy**. The CSP is intentionally not a nonce-based strict policy: Next's hydration scripts, `next-themes`, and Radix all need inline code, and nonces would force every page to render dynamically. It still blocks framing and plugins (`frame-ancestors 'none'`, `object-src 'none'`), and limits `connect-src` to this origin and your Supabase project, so injected script could not send data to an arbitrary host. Gemini is server-only and deliberately absent. The CSP is production-only (`next dev` needs `unsafe-eval`) and its Supabase origin is read from `NEXT_PUBLIC_SUPABASE_URL` **at build time**.
- **Error hygiene.** Failures return `{ error, code }` with a user-safe message. Database and provider details, stack traces, and environment variable names go to the server log only (the log records error codes and lengths, not email content), and configuration hints appear in responses only outside production.

### Rate limiting — a real limitation

Three limiters are implemented (`src/lib/rate-limit.ts`, configured in `src/lib/api/limits.ts`): AI requests per user (default 15/min), email/template writes per user (120/min), and all `/api/*` requests per IP (300/min, checked before any Supabase call).

**These are in-memory and best-effort. They are not distributed.** State lives in one server process. On Vercel, requests can be handled by many independent function instances that don't share memory, and instances are recycled — so the effective limit is *per warm instance*, and a determined client can exceed it. It is meant to stop obvious hammering (a stuck retry loop, a simple script) at zero cost. It is **not** a security boundary or a billing guard. If you need a hard guarantee, put a shared store (e.g. Upstash Redis) behind the same `check(key)` interface in `rate-limit.ts`. The per-IP limiter trusts `x-vercel-forwarded-for` / `x-forwarded-for`, which is only spoofproof behind Vercel or a proxy that overwrites them; the per-user limiters are unaffected by that. Set a spending cap on your Google AI Studio project regardless.

### Environment variables

| Variable | Required | Exposed to browser | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Yes (by design) | Must be `https://` in production. Inlined at **build** time. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Yes (by design) | The anon/publishable key only. `check:env` fails if it is a `service_role` key. |
| `GEMINI_API_KEY` | **Yes** | **No** | Server-only. AI routes return a config error without it. |
| `GEMINI_MODEL` | Recommended | No | Defaults to `gemini-3.5-flash`. Set it explicitly; Google retires models. |
| `AI_PROVIDER` | No | No | Defaults to `gemini` (the only provider implemented). |
| `SUPABASE_SERVICE_ROLE_KEY` | **No — leave unset** | **Never** | No route uses it. Omitting it reduces the damage a leak could do. |
| `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS` | No | No | Default 15 per 60000 ms. |
| `API_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MS` | No | No | Default 120 per 60000 ms (writes, per user). |
| `API_IP_RATE_LIMIT_MAX` | No | No | Default 300 per window (per IP). |

A missing variable never breaks `next build` (CI and local development legitimately run without secrets). Instead, each operation fails clearly when it actually needs one, the server logs a `[config]` line naming any problem variable at startup, and **`npm run check:env`** — which prints names only, never values — exits non-zero if something required is missing or unsafe, so you can gate a deploy on it.

### Local testing

```bash
npm install
cp .env.example .env.local        # fill in Supabase + Gemini values
# Run supabase/migrations/0001…0004 in the Supabase SQL Editor, in order
npm run dev                       # http://localhost:3000

npm run lint
npm run typecheck                 # tsc --noEmit
npm test                          # unit tests (Node 22.6+; uses Node's built-in runner, no extra dependencies)
npm run build
npm run check:env                 # environment sanity check (names only)
npm run check:bundle              # after build: fail if a secret is in client-visible output
npm run verify                    # lint + typecheck + test + build
```

### Deployment

The project is designed for **Vercel + Supabase + Gemini** and uses no paid infrastructure beyond what those free tiers include. It has not been deployed as part of this work. Set the variables above in the Vercel project **before** the first build (the `NEXT_PUBLIC_` values and the CSP's Supabase origin are fixed at build time, so changing them means redeploying). Run the four migrations, add your deployed URL and `/auth/callback` under Supabase → Authentication → URL Configuration, run `npm run check:env` with the production values, and then deploy. The AI routes set `maxDuration = 30`; the Gemini call itself times out at 20 seconds.

### Known limitations (Phase 6)

- Rate limiting is per instance (above). There is no per-user storage quota; a user is limited only by the write rate limit.
- The list endpoints are capped (500 emails / 200 templates) without pagination or a UI notice yet.
- If a draft is deleted from another tab while still open here, the next autosave recreates it (deliberately, so typed text is never lost).
- The CSP allows inline scripts and styles (see above).
- The `src/lib/storage/local-*` stores remain for running without Supabase, but AI routes now need Supabase auth, so that mode is of limited use.

## Manual test checklist

Run against a real Supabase project + Gemini key. Phase 4's checklist (auth redirects, session persistence, save/favorite/delete round-trips through a refresh) plus, for Phase 5:

**Compose:** generate → regenerate → generate subject → Polish → Change tone (each of the 7) → Shorten → Expand → Fix grammar → Make clearer → Save Draft → reload `/compose?id=...` and confirm every field (including additional instructions) restored → Update Draft → Delete Draft → start a fresh draft, wait 3s+ idle with content typed, confirm "Saving draft…" → "Draft saved" appears and a row exists in `emails` with `type=draft` → Save to history (confirm the row's `type` becomes `generated`, not a duplicate row) → start Compose from a template (`/templates` → Use) and confirm subject/body populate and the URL cleans up to `/compose`.

**Reply:** generate reply → regenerate → Polish/Change tone/Shorten/Expand/Fix grammar/Make clearer → Generate Subject → Analyze → Summarize (confirm no invented deadline when the pasted email has none) → Analyze → Extract action items (confirm `owner`/`deadline` show "Not specified" rather than a guess when not stated) → Save Draft → Update Draft → Delete Draft → Save to history → reopen via History (confirm it routes to `/reply?id=...`, not `/compose?id=...`).

**Templates:** browse built-ins → search → filter by category → Preview → Use (opens Compose pre-filled) → create a custom template → edit it → delete it → confirm built-in templates show no Edit/Delete controls → confirm signing in as a second account cannot see the first account's custom templates (list, and a direct `PATCH`/`DELETE /api/templates/[id]` against the first account's template id both fail).

**History:** search subject/body/recipient → filter by each type (All/Generated/Reply/Draft) → filter Favorites/Not favorites → date range → sort newest/oldest → combine filters → reset → confirm the mobile "Filters" dialog and the desktop inline selects stay in sync (same state).

**Security:** confirm `GET /api/emails` and `GET /api/templates` return only the caller's rows even when another account has data; confirm a direct `PATCH`/`DELETE` against another account's email or template id returns 404 (not 200 or 403 — see the ownership-filtered-query pattern in the route files); confirm `/api/ai/summarize-email` and `/api/ai/action-items` reject a body without `email` and reject an oversized one; confirm `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never appear in any client bundle or network response. **(Phase 6)** Also: signed out, `POST` to each `/api/ai/*` route returns `401`; exceeding `AI_RATE_LIMIT_MAX` returns `429` with `Retry-After`; `/login?redirectTo=https://example.com` lands on `/dashboard`, not example.com; a body with `user_id` is rejected; and signing out in a second tab while composing shows the session banner instead of losing your text.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is read only in `src/lib/supabase/admin.ts`, which is not imported by any route — nothing server-rendered or client-rendered ships it to the browser.
- No secret is prefixed `NEXT_PUBLIC_`; only the Supabase URL and anon key are, and the anon key is meant to be public — it only grants what RLS allows.
- Every `/api/emails*` and **(Phase 5)** `/api/templates*` route derives `user_id` from the verified session (via `withAuth`), never from the request body — and **(Phase 6)** a body containing `user_id` is now rejected with 400 rather than ignored — and additionally filters by that id even though RLS would already enforce it.
- RLS is enabled on `public.emails` with four policies (`select`/`insert`/`update`/`delete`), each scoped to `auth.uid() = user_id`. **(Phase 5)** The same four-policy shape is enabled on `public.templates`. Neither table has an "authenticated users can read everything" policy.
- **(Phase 6)** Every `/api/ai/*` route requires a signed-in user. Earlier phases left them open on the reasoning that they touch no stored data — but an open AI endpoint spends *your* Gemini quota for anyone who finds the URL, so that reasoning was wrong and is reversed. Unauthenticated requests get `401` before any body is read or the provider is contacted.

## What's not implemented yet

Gmail/Outlook integration, sending email, OAuth providers, billing/Stripe, team accounts, collaboration, bulk email, contact scraping, and an admin dashboard are intentionally out of scope — planned for a future phase.

