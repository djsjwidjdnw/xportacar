-- =====================================================================
-- XportACar — Phase 3 schema: editable platform settings
-- Single-row config table keyed by a fixed UUID so the admin settings
-- screen can update without UPSERT gymnastics.  Safe to re-run.
-- =====================================================================

create table if not exists public.platform_settings (
  id                       uuid primary key default '00000000-0000-0000-0000-000000000001',
  platform_name            text   not null default 'XportACar',
  fee_percentage           numeric(5,2) not null default 5.00,
  default_auction_days     int    not null default 7,
  min_bid_increment_eur    int    not null default 100,
  reserve_enforced         boolean not null default true,
  proxy_bidding_enabled    boolean not null default true,
  buy_now_enabled          boolean not null default true,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles(id) on delete set null
);

-- Seed the single row.  ON CONFLICT keeps re-runs idempotent.
insert into public.platform_settings (id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- RLS: every role can read (the settings drive UI), only admin/superadmin
-- can update.
alter table public.platform_settings enable row level security;

drop policy if exists "anyone reads settings" on public.platform_settings;
create policy "anyone reads settings"
  on public.platform_settings for select
  using (true);

drop policy if exists "admins update settings" on public.platform_settings;
create policy "admins update settings"
  on public.platform_settings for update
  using (
    exists (select 1 from public.profiles
            where id = auth.uid()
              and role in ('admin', 'superadmin'))
  );
