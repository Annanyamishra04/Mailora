-- AI Mail Studio — Phase 6 hardening
--
-- Defense in depth for the database itself. The API routes already validate
-- everything, but Supabase also exposes these tables directly through
-- PostgREST to any signed-in user holding the (public) anon key. Row Level
-- Security stops that user touching OTHER people's rows; it does not stop
-- them writing arbitrary-sized or nonsensical values into their OWN rows,
-- bypassing the API's validation. These constraints close that gap, and
-- mirror the limits in src/lib/validation/{emails,templates}.ts exactly.
--
-- Run once, AFTER 0001-0003 (SQL Editor or `supabase db push`). Safe to re-run.
-- Verified against a real Postgres: applies cleanly in order, re-runs cleanly,
-- and row-level isolation between two users still holds afterwards.
--
-- Note: if you ever re-run 0001, run this file again afterwards — 0001's
-- `create or replace function public.set_updated_at()` resets the pinned
-- search_path set at the bottom of this file.
--
-- Constraints are added NOT VALID: they are enforced for every new insert
-- and update immediately, but existing rows aren't scanned, so this can
-- never fail on data written by an earlier phase. To also verify old rows,
-- run the `validate constraint` statements at the bottom afterwards.
--
-- Note: Postgres char_length() counts code points, JS String.length counts
-- UTF-16 units, so anything the API accepts always satisfies these checks.

-- ---------------------------------------------------------------------------
-- public.emails
-- ---------------------------------------------------------------------------

alter table public.emails drop constraint if exists emails_tone_check;
alter table public.emails add constraint emails_tone_check
  check (tone in ('professional','formal','friendly','casual','persuasive','apologetic','confident')) not valid;

alter table public.emails drop constraint if exists emails_length_check;
alter table public.emails add constraint emails_length_check
  check (length in ('short','medium','detailed')) not valid;

alter table public.emails drop constraint if exists emails_field_sizes_check;
alter table public.emails add constraint emails_field_sizes_check
  check (
    char_length(recipient) <= 320
    and char_length(subject) <= 500
    and char_length(body) <= 30000
    and (purpose is null or char_length(purpose) <= 2000)
    and (additional_instructions is null or char_length(additional_instructions) <= 1000)
  ) not valid;

-- ---------------------------------------------------------------------------
-- public.templates
-- ---------------------------------------------------------------------------

alter table public.templates drop constraint if exists templates_category_check;
alter table public.templates add constraint templates_category_check
  check (category in (
    'job-application','follow-up','meeting-request','thank-you','leave-request',
    'networking','internship-inquiry','project-update','other'
  )) not valid;

alter table public.templates drop constraint if exists templates_field_sizes_check;
alter table public.templates add constraint templates_field_sizes_check
  check (
    char_length(name) between 1 and 150
    and (description is null or char_length(description) <= 300)
    and char_length(subject) <= 300
    and char_length(body) <= 20000
  ) not valid;

-- Custom templates are always user rows; the app never writes is_builtin = true here.
alter table public.templates drop constraint if exists templates_not_builtin_check;
alter table public.templates add constraint templates_not_builtin_check
  check (is_builtin = false) not valid;

-- ---------------------------------------------------------------------------
-- RLS performance: evaluate auth.uid() once per statement, not once per row.
-- ---------------------------------------------------------------------------
-- `auth.uid() = user_id` re-evaluates the function for every row scanned.
-- Wrapping it in a scalar subquery lets Postgres hoist it into an InitPlan
-- (Supabase's documented RLS optimization). ALTER POLICY changes the
-- expression in place — there is never a moment without a policy — and the
-- meaning is identical: a row is visible/changeable only to its owner.

alter policy "Users can view their own emails"   on public.emails using ((select auth.uid()) = user_id);
alter policy "Users can insert their own emails" on public.emails with check ((select auth.uid()) = user_id);
alter policy "Users can update their own emails" on public.emails using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "Users can delete their own emails" on public.emails using ((select auth.uid()) = user_id);

alter policy "Users can view their own templates"   on public.templates using ((select auth.uid()) = user_id);
alter policy "Users can insert their own templates" on public.templates with check ((select auth.uid()) = user_id);
alter policy "Users can update their own templates" on public.templates using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "Users can delete their own templates" on public.templates using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Function hygiene
-- ---------------------------------------------------------------------------
-- Pin the trigger function's search_path (Supabase linter: "function search
-- path mutable"). It only calls now(), which lives in pg_catalog — always
-- searched — so an empty search_path changes nothing functionally.
alter function public.set_updated_at() set search_path = '';

-- ---------------------------------------------------------------------------
-- Indexes: audited, none added.
-- ---------------------------------------------------------------------------
-- Every query in the app is "rows for one user, newest first" (list) or
-- "row by primary key AND user" (update/delete). Those are served by the
-- existing (user_id, created_at desc) indexes from 0001/0003 and the
-- primary keys. Extra indexes would only slow writes — including autosave,
-- which updates a row every few seconds while someone types.

-- ---------------------------------------------------------------------------
-- Optional: verify pre-existing rows too (run after confirming no violations)
-- ---------------------------------------------------------------------------
-- alter table public.emails    validate constraint emails_tone_check;
-- alter table public.emails    validate constraint emails_length_check;
-- alter table public.emails    validate constraint emails_field_sizes_check;
-- alter table public.templates validate constraint templates_category_check;
-- alter table public.templates validate constraint templates_field_sizes_check;
-- alter table public.templates validate constraint templates_not_builtin_check;
