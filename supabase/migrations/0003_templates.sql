-- AI Mail Studio — Phase 5 schema addition
--
-- User-owned email templates. Built-in/starter templates (Job Application,
-- Follow-up, Meeting Request, etc.) are NOT stored here — they ship in
-- application code (see src/lib/templates/builtin.ts) since they're
-- identical for every user and never change at runtime. This table only
-- ever holds templates a signed-in user created themselves, which is why
-- `user_id` is `not null` here (unlike the nullable-for-built-ins shape
-- suggested when templates are fully database-backed).
--
-- Run this once against your Supabase project (SQL Editor, or
-- `supabase db push` / the Supabase CLI). Safe to re-run.

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  subject text not null default '',
  body text not null default '',
  category text not null default 'other',
  -- Always false for rows in this table (see note above) — kept as a real
  -- column rather than assumed, so the shape matches a future database-backed
  -- built-in template without a migration, and so application code never has
  -- to special-case "rows from this table are always custom".
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_user_id_created_at_idx
  on public.templates (user_id, created_at desc);

-- Reuses the same `set_updated_at()` trigger function created in
-- 0001_emails.sql.
drop trigger if exists templates_set_updated_at on public.templates;

create trigger templates_set_updated_at
  before update on public.templates
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Same shape as public.emails: every policy scoped to auth.uid(), no
-- "authenticated users can read all rows" policy anywhere here.

alter table public.templates enable row level security;

drop policy if exists "Users can view their own templates" on public.templates;
create policy "Users can view their own templates"
  on public.templates for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own templates" on public.templates;
create policy "Users can insert their own templates"
  on public.templates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own templates" on public.templates;
create policy "Users can update their own templates"
  on public.templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own templates" on public.templates;
create policy "Users can delete their own templates"
  on public.templates for delete
  using (auth.uid() = user_id);
