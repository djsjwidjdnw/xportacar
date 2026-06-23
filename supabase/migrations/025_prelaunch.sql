-- =====================================================================
-- 025 — Pre-launch landing: email capture + app settings (landing toggle +
--        countdown). Idempotent. Apply in the Supabase SQL editor.
--
-- NOTE: admin policies use public.is_admin(auth.uid()) (admin + superadmin) to
-- match the /admin layout gate, NOT a bare role = 'admin' check — otherwise a
-- superadmin would be locked out of the pre-launch tab.
-- =====================================================================

-- ---------------------------------------------------------------------
-- prelaunch_signups — marketing email capture from the landing page.
-- ---------------------------------------------------------------------
create table if not exists public.prelaunch_signups (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  source            text default 'landing',
  user_agent        text,
  ip_country        text,
  resend_contact_id text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_prelaunch_signups_created_at
  on public.prelaunch_signups(created_at desc);

-- ---------------------------------------------------------------------
-- app_settings — small key/value store for the landing toggle + countdown.
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.app_settings (key, value) values
  ('landing_mode_enabled', 'true'::jsonb),
  ('launch_countdown_target', 'null'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.prelaunch_signups enable row level security;
alter table public.app_settings      enable row level security;

-- Anyone may submit a signup (the landing form posts via the server, but allow
-- anon directly too). No SELECT for the public — only admins read the list.
drop policy if exists "Public can submit prelaunch signup" on public.prelaunch_signups;
create policy "Public can submit prelaunch signup"
  on public.prelaunch_signups for insert to anon, authenticated
  with check (true);

drop policy if exists "Admins can read prelaunch signups" on public.prelaunch_signups;
create policy "Admins can read prelaunch signups"
  on public.prelaunch_signups for select to authenticated
  using (public.is_admin(auth.uid()));

-- Everyone can read settings (the public homepage checks the landing toggle).
drop policy if exists "Public can read settings" on public.app_settings;
create policy "Public can read settings"
  on public.app_settings for select to anon, authenticated
  using (true);

-- Only admins/superadmins write settings.
drop policy if exists "Admins write settings" on public.app_settings;
create policy "Admins write settings"
  on public.app_settings for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
