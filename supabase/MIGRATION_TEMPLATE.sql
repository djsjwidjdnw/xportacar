-- =====================================================================
-- NNN_short_name.sql — one-line purpose.
--
-- Copy to supabase/migrations/NNN_short_name.sql (next free number).
-- Idempotent: guards / `if not exists` / `on conflict`, so a re-run is safe.
-- Rehearse in a rolled-back transaction against production before applying.
--
-- GRANTS RULE (from 30 Oct 2026): Supabase no longer auto-grants Data API
-- access to new tables in `public`. A table created without grants exists but
-- returns "permission denied" through supabase-js / PostgREST / GraphQL —
-- including on preview branches and after a local `supabase db reset`.
-- Every CREATE TABLE in `public` carries its grants IN THE SAME FILE.
-- Omit the anon line for admin-only tables. The grants sit alongside RLS
-- (and any REVOKE / ALTER DEFAULT PRIVILEGES work), never instead of it.
-- =====================================================================

create table if not exists public.example_things (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.example_things enable row level security;

drop policy if exists "owners read their things" on public.example_things;
create policy "owners read their things"
  on public.example_things for select
  using (auth.uid() = owner_id);

-- Data API grants (RLS still decides which rows each role sees).
grant select on public.example_things to anon;                                   -- omit for admin-only tables
grant select, insert, update, delete on public.example_things to authenticated;
grant select, insert, update, delete on public.example_things to service_role;
