-- =====================================================================
-- 004_vehicle_valuations.sql
-- AI valuation cache + live shipping rate table (admin-editable).
-- Idempotent: IF NOT EXISTS everywhere; policies dropped before create.
-- =====================================================================

-- ---------------------------------------------------------------------
-- vehicle_valuations — cache of market valuations (API or estimate).
-- Reused for 7 days to save API calls.
-- ---------------------------------------------------------------------
create table if not exists public.vehicle_valuations (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid references public.vehicles(id) on delete cascade,
  make        text not null,
  model       text not null,
  year        int  not null,
  mileage_km  int  not null default 0,
  min_eur     numeric not null,
  avg_eur     numeric not null,
  max_eur     numeric not null,
  data_points int  not null default 0,
  source      text not null default 'estimate',   -- 'market_data' | 'estimate'
  confidence  text not null default 'low',         -- 'high' | 'medium' | 'low'
  fetched_at  timestamptz not null default now()
);

-- Lookup by the cache key (make/model/year/mileage bucket) and by vehicle.
create index if not exists idx_valuations_lookup  on public.vehicle_valuations(make, model, year, mileage_km, fetched_at desc);
create index if not exists idx_valuations_vehicle on public.vehicle_valuations(vehicle_id);

alter table public.vehicle_valuations enable row level security;

drop policy if exists "valuations are public" on public.vehicle_valuations;
create policy "valuations are public"
  on public.vehicle_valuations for select using (true);

-- Writes happen server-side via the service-role client (bypasses RLS); also
-- allow staff to write so an authenticated admin tool can cache directly.
drop policy if exists "staff write valuations" on public.vehicle_valuations;
create policy "staff write valuations"
  on public.vehicle_valuations for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- shipping_rates — admin-editable live shipping rates + service fees.
-- method: roro | container | door_to_door | warehouse | service
-- For %-based services (marine insurance) rate_pct holds the percentage and
-- base_price_eur the minimum fee.
-- ---------------------------------------------------------------------
create table if not exists public.shipping_rates (
  id               uuid primary key default gen_random_uuid(),
  route_key        text not null unique,
  origin_port      text,
  destination_port text,
  method           text not null,
  base_price_eur   numeric not null default 0,
  rate_pct         numeric,                 -- e.g. 1.5 for marine insurance
  transit_days_min int,
  transit_days_max int,
  active           boolean not null default true,
  last_verified    date not null default current_date,
  notes            text,
  sort_order       int not null default 0,
  updated_at       timestamptz not null default now()
);

create index if not exists idx_shipping_rates_active on public.shipping_rates(active, method, sort_order);

alter table public.shipping_rates enable row level security;

drop policy if exists "shipping rates are public" on public.shipping_rates;
create policy "shipping rates are public"
  on public.shipping_rates for select using (true);

drop policy if exists "staff manage shipping rates" on public.shipping_rates;
create policy "staff manage shipping rates"
  on public.shipping_rates for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- Seed current Dubai (Jebel Ali) → EU rates + service fees.
-- on conflict (route_key) keeps re-runs idempotent and refreshes prices.
-- ---------------------------------------------------------------------
insert into public.shipping_rates
  (route_key, origin_port, destination_port, method, base_price_eur, rate_pct, transit_days_min, transit_days_max, notes, sort_order)
values
  -- RoRo
  ('roro_hamburg',     'Dubai (Jebel Ali)', 'Hamburg',     'roro', 1800, null, 28, 35, 'Roll-on/Roll-off',                 10),
  ('roro_rotterdam',   'Dubai (Jebel Ali)', 'Rotterdam',   'roro', 1600, null, 25, 30, 'Roll-on/Roll-off',                 11),
  ('roro_bremerhaven', 'Dubai (Jebel Ali)', 'Bremerhaven', 'roro', 1750, null, 28, 35, 'Roll-on/Roll-off',                 12),
  ('roro_antwerp',     'Dubai (Jebel Ali)', 'Antwerp',     'roro', 1650, null, 25, 32, 'Roll-on/Roll-off',                 13),
  ('roro_genoa',       'Dubai (Jebel Ali)', 'Genoa',       'roro', 2000, null, 20, 25, 'Roll-on/Roll-off',                 14),
  ('roro_barcelona',   'Dubai (Jebel Ali)', 'Barcelona',   'roro', 2100, null, 22, 28, 'Roll-on/Roll-off',                 15),
  -- Container (20ft shared)
  ('container_hamburg',     'Dubai (Jebel Ali)', 'Hamburg',     'container', 2400, null, 28, 35, '20ft shared container', 20),
  ('container_rotterdam',   'Dubai (Jebel Ali)', 'Rotterdam',   'container', 2200, null, 25, 30, '20ft shared container', 21),
  ('container_bremerhaven', 'Dubai (Jebel Ali)', 'Bremerhaven', 'container', 2350, null, 28, 35, '20ft shared container', 22),
  ('container_genoa',       'Dubai (Jebel Ali)', 'Genoa',       'container', 2600, null, 20, 25, '20ft shared container', 23),
  -- Services / add-ons
  ('warehouse_dubai',  'Dubai (Jebel Ali)', null, 'warehouse',    0,   null, 0,  0,  'Warehouse pickup — available immediately after payment', 1),
  ('door_to_door_eu',  null, null, 'door_to_door',  800,  null, 30, 45, 'Door-to-door delivery in the EU — adds €800–1,500 on top of the port rate depending on distance', 30),
  ('service_tuv',           null, null, 'service', 750, null,  null, null, 'German TÜV / papers: inspection for DE registration, CoC certificate, customs paperwork', 40),
  ('service_marine_insurance', null, null, 'service', 150, 1.5, null, null, 'Marine insurance: 1.5% of declared vehicle value (minimum €150)', 41),
  ('service_customs_export_uae', null, null, 'service', 200, null, null, null, 'UAE export customs clearance', 42),
  ('service_customs_import_eu',  null, null, 'service', 350, null, null, null, 'EU import customs + VAT processing', 43)
on conflict (route_key) do update set
  origin_port      = excluded.origin_port,
  destination_port = excluded.destination_port,
  method           = excluded.method,
  base_price_eur   = excluded.base_price_eur,
  rate_pct         = excluded.rate_pct,
  transit_days_min = excluded.transit_days_min,
  transit_days_max = excluded.transit_days_max,
  notes            = excluded.notes,
  sort_order       = excluded.sort_order,
  last_verified    = current_date,
  updated_at       = now();
