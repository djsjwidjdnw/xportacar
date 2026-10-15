-- =====================================================================
-- 034 — UAE vs EU market prices (built dormant) + Integrations key storage.
--
-- Every car page can show two market prices from real listings: what the car
-- sells for in the UAE (Dubizzle Motors comparables, run through an Apify
-- actor) and in Europe (Vincario "vehicle market value", europe group). The
-- market-prices Edge Function looks them up once per listing, when an admin
-- publishes or relists a car, and stores one row per car here.
--
-- This migration:
--   1. adds app_settings.market_prices_enabled (false: the feature is OFF) and
--      app_settings.market_prices_apify_actor (the Dubizzle actor; swappable
--      without a deploy);
--   2. creates vehicle_market_prices (public read for publicly visible cars,
--      admin read for all, writes by the service role only),
--      market_price_lookups (every external lookup with its records and
--      estimated cost, admin read) and market_fx_rates (the day's ECB rate,
--      fetched at most once a day, admin read);
--   3. adds the Integrations key functions. Keys live in Supabase Vault under
--      market_vincario_api_key, market_vincario_secret_key and
--      market_apify_token. admin_set_market_price_key() can only set, replace
--      or clear a key and returns at most its last 4 characters;
--      admin_market_price_keys_status() returns whether each key is set and
--      its last 4 characters. Both are admin-only. No function, view or page
--      returns a full key: the Edge Function reads Vault over its own
--      database connection;
--   4. guards app_settings so market_prices_enabled cannot be switched on
--      while any of the three keys is missing (clearing a key switches it off).
--
-- GRANTS RULE: the three new tables carry their grants below. The live default
-- ACL still grants ALL on new public tables to anon and authenticated, so each
-- table first revokes everything from the API roles, then grants per the rule
-- (no anon line on the admin-only tables). RLS decides which rows a role sees.
--
-- Additive + idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Settings. Off by default; the actor id can be swapped without a deploy.
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('market_prices_enabled', 'false'::jsonb),
  ('market_prices_apify_actor', '"memo23/dubizzle-search-listing-s-scraper"'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2a. Results: one row per car. A side that was never looked up has a null
--     status; 'insufficient_data' covers "not enough UAE data" (fewer than 3
--     comparables) and Vincario's "Insufficient statistical data".
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_market_prices (
  vehicle_id        uuid primary key references public.vehicles(id) on delete cascade,
  -- UAE side: median of Dubizzle Motors comparables (same make and model, year
  -- within +/- 1, obvious outliers dropped), in AED and converted to EUR.
  uae_median_aed    numeric(12,2),
  uae_median_eur    numeric(12,2),
  uae_count         integer,
  uae_status        text check (uae_status in ('ok', 'insufficient_data', 'error')),
  uae_error         text,
  uae_source        text,
  uae_fetched_at    timestamptz,
  -- EU side: Vincario vehicle market value, europe group median and count.
  eu_median_eur     numeric(12,2),
  eu_count          integer,
  eu_status         text check (eu_status in ('ok', 'insufficient_data', 'error')),
  eu_error          text,
  eu_fetched_at     timestamptz,
  -- EUR per 1 AED used for uae_median_eur: the day's ECB EUR/USD reference
  -- rate and the AED/USD peg (the ECB publishes no AED rate).
  fx_rate           numeric(14,10),
  fx_date           date,
  -- Set while a lookup runs, so a double publish cannot pay twice.
  lookup_started_at timestamptz,
  fetched_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

alter table public.vehicle_market_prices enable row level security;

-- Same status list as the vehicles policy that makes a car publicly visible.
drop policy if exists "market prices of public vehicles are public" on public.vehicle_market_prices;
create policy "market prices of public vehicles are public"
  on public.vehicle_market_prices for select
  to anon, authenticated
  using (exists (
    select 1 from public.vehicles v
     where v.id = vehicle_market_prices.vehicle_id
       and v.status in ('listed', 'in_auction', 'sold', 'payment_pending', 'paid',
                        'collected', 'shipped', 'delivered')
  ));

drop policy if exists "admins read all market prices" on public.vehicle_market_prices;
create policy "admins read all market prices"
  on public.vehicle_market_prices for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- No insert/update/delete policies: only the service role (market-prices Edge
-- Function) writes, and it bypasses RLS.
revoke all on public.vehicle_market_prices from anon, authenticated;
grant select on public.vehicle_market_prices to anon;
grant select, insert, update, delete on public.vehicle_market_prices to authenticated;
grant select, insert, update, delete on public.vehicle_market_prices to service_role;

-- ---------------------------------------------------------------------
-- 2b. Usage log: one row per external lookup (Vincario, Apify, FX), with the
--     records it returned and its estimated cost, for the monthly usage view.
-- ---------------------------------------------------------------------
create table if not exists public.market_price_lookups (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  vehicle_id    uuid references public.vehicles(id) on delete set null,
  service       text not null check (service in ('vincario', 'apify', 'fx')),
  triggered_by  text not null check (triggered_by in ('publish', 'relist', 'refresh', 'test')),
  success       boolean not null,
  records       integer,
  est_cost      numeric(10,4) not null default 0,
  cost_currency text not null default 'EUR' check (cost_currency in ('EUR', 'USD')),
  error         text,
  duration_ms   integer
);

create index if not exists idx_market_price_lookups_service_created
  on public.market_price_lookups (service, created_at desc);

alter table public.market_price_lookups enable row level security;

drop policy if exists "admins read market price lookups" on public.market_price_lookups;
create policy "admins read market price lookups"
  on public.market_price_lookups for select
  to authenticated
  using (public.is_admin(auth.uid()));

revoke all on public.market_price_lookups from anon, authenticated;
grant select, insert, update, delete on public.market_price_lookups to authenticated;
grant select, insert, update, delete on public.market_price_lookups to service_role;

-- ---------------------------------------------------------------------
-- 2c. FX cache: the day's rate, fetched at most once per UTC day.
-- ---------------------------------------------------------------------
create table if not exists public.market_fx_rates (
  fetched_on  date primary key,
  ecb_date    date not null,
  usd_per_eur numeric(12,6) not null,
  aed_per_usd numeric(10,4) not null,
  eur_per_aed numeric(14,10) not null,
  source      text not null,
  created_at  timestamptz not null default now()
);

alter table public.market_fx_rates enable row level security;

drop policy if exists "admins read market fx rates" on public.market_fx_rates;
create policy "admins read market fx rates"
  on public.market_fx_rates for select
  to authenticated
  using (public.is_admin(auth.uid()));

revoke all on public.market_fx_rates from anon, authenticated;
grant select, insert, update, delete on public.market_fx_rates to authenticated;
grant select, insert, update, delete on public.market_fx_rates to service_role;

-- ---------------------------------------------------------------------
-- 3. Key storage (Vault). Write-only from the app's side.
-- ---------------------------------------------------------------------

-- Set, replace (non-empty p_value) or clear (empty/null p_value) one of the
-- three market-price keys. Returns the key's last 4 characters, or null after
-- a clear. Clearing a key switches market_prices_enabled off.
create or replace function public.admin_set_market_price_key(p_name text, p_value text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_value text := nullif(btrim(coalesce(p_value, '')), '');
  v_id    uuid;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  if p_name is null
     or p_name not in ('market_vincario_api_key', 'market_vincario_secret_key', 'market_apify_token') then
    raise exception 'UNKNOWN_KEY' using errcode = '22023';
  end if;

  select s.id into v_id from vault.secrets s where s.name = p_name;

  if v_value is null then
    if v_id is not null then
      delete from vault.secrets s where s.id = v_id;
      insert into public.admin_audit_log (actor_id, entity_type, entity_id, action, changes)
      values (auth.uid(), 'integration_key', v_id, 'clear_key', jsonb_build_object('name', p_name));
    end if;
    update public.app_settings
       set value = 'false'::jsonb, updated_at = now(), updated_by = auth.uid()
     where key = 'market_prices_enabled' and value = 'true'::jsonb;
    return null;
  end if;

  if length(v_value) < 8 or length(v_value) > 512 or v_value ~ '[[:space:]]' then
    raise exception 'INVALID_KEY_FORMAT' using errcode = '22023';
  end if;

  if v_id is null then
    v_id := vault.create_secret(v_value, p_name, 'XportACar market prices key, set on the admin Integrations page');
  else
    perform vault.update_secret(v_id, v_value);
  end if;

  insert into public.admin_audit_log (actor_id, entity_type, entity_id, action, changes)
  values (auth.uid(), 'integration_key', v_id, 'set_key',
          jsonb_build_object('name', p_name, 'last4', right(v_value, 4)));

  return right(v_value, 4);
end
$$;

revoke all on function public.admin_set_market_price_key(text, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_market_price_key(text, text) to authenticated;

-- Whether each key is set, and its last 4 characters. Never the key itself.
create or replace function public.admin_market_price_keys_status()
returns table (key_name text, is_set boolean, last4 text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  return query
    select n.k,
           s.id is not null,
           case when s.id is null then null::text else right(s.decrypted_secret, 4) end,
           s.updated_at
      from unnest(array['market_vincario_api_key', 'market_vincario_secret_key', 'market_apify_token']::text[]) as n(k)
      left join vault.decrypted_secrets s on s.name = n.k;
end
$$;

revoke all on function public.admin_market_price_keys_status() from public, anon, authenticated, service_role;
grant execute on function public.admin_market_price_keys_status() to authenticated;

-- ---------------------------------------------------------------------
-- 4. The master switch refuses to turn on while any key is missing.
-- ---------------------------------------------------------------------
create or replace function public.guard_market_prices_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.value = 'true'::jsonb and (
       select count(*) from vault.secrets s
        where s.name in ('market_vincario_api_key', 'market_vincario_secret_key', 'market_apify_token')
     ) < 3 then
    raise exception 'MARKET_PRICES_KEYS_MISSING'
      using errcode = '23514',
            hint = 'Add the Vincario API key, the Vincario secret key and the Apify token on the admin Integrations page first.';
  end if;
  return new;
end
$$;

revoke all on function public.guard_market_prices_enabled() from public, anon, authenticated, service_role;

drop trigger if exists trg_app_settings_market_prices_guard on public.app_settings;
create trigger trg_app_settings_market_prices_guard
  before insert or update on public.app_settings
  for each row
  when (new.key = 'market_prices_enabled')
  execute function public.guard_market_prices_enabled();
