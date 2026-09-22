-- AI Mail Studio — Phase 4 schema
--
-- Run this once against your Supabase project (SQL Editor, or
-- `supabase db push` / the Supabase CLI if you use migrations locally).
-- Safe to re-run: every statement is idempotent.

-- gen_random_uuid() lives in pgcrypto on most Supabase projects.
create extension if not exists "pgcrypto";

create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default '',
  body text not null default '',
  recipient text not null default '',
  tone text not null default 'professional',
  length text not null default 'medium',
  type text not null default 'generated' check (type in ('generated', 'reply', 'draft')),
  purpose text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every list/history query filters by user and sorts by recency.
create index if not exists emails_user_id_created_at_idx
  on public.emails (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists emails_set_updated_at on public.emails;

create trigger emails_set_updated_at
  before update on public.emails
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Every policy is scoped to auth.uid() — there is no "authenticated users
-- can read all rows" policy anywhere here. A user can only ever see,
-- create, change, or remove their own emails.

alter table public.emails enable row level security;

drop policy if exists "Users can view their own emails" on public.emails;
create policy "Users can view their own emails"
  on public.emails for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own emails" on public.emails;
create policy "Users can insert their own emails"
  on public.emails for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own emails" on public.emails;
create policy "Users can update their own emails"
  on public.emails for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own emails" on public.emails;
create policy "Users can delete their own emails"
  on public.emails for delete
  using (auth.uid() = user_id);
