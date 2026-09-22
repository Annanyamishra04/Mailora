-- AI Mail Studio — Phase 5 schema addition
--
-- Adds a column to store the "additional instructions" field that Compose
-- drafts can carry alongside their purpose. Needed so a saved draft can be
-- fully restored (recipient, subject, body, tone, length, additional
-- instructions) rather than losing that one field on save.
--
-- Safe to re-run: uses `if not exists`.

alter table public.emails
  add column if not exists additional_instructions text;

-- No RLS changes needed — existing policies on public.emails already cover
-- every column on the row, including this new one.
