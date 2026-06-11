-- =====================================================================
-- 015 — AED-native pricing, paint-thickness readings, lifecycle statuses,
--       invoice line items. Foundation for the inspector/buyer/admin batch.
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Lifecycle statuses (Task 20).  sold + delivered already exist (001); add the
-- two intermediate ones. ALTER TYPE ADD VALUE must NOT be wrapped in a DO block
-- or used in the same statement, so run them standalone first.
-- ---------------------------------------------------------------------
alter type vehicle_status add value if not exists 'picked_up';
alter type vehicle_status add value if not exists 'in_transit';

-- ---------------------------------------------------------------------
-- Task 4 — AED-native pricing. The inspector enters AED; EUR is auto-derived
-- at a fixed rate so the buyer side (which already renders the user's preferred
-- currency from *_eur) needs no change.
-- ---------------------------------------------------------------------
alter table public.vehicles
  add column if not exists price_aed       numeric(12,2),
  add column if not exists reserve_price_aed numeric(12,2),
  add column if not exists buy_now_price_aed numeric(12,2);

-- Fixed conversion (1 EUR = 3.92 AED). When an AED price is present it drives
-- the matching _eur column; Buy Now clears _eur when AED is null (Task 7: no
-- Buy Now unless explicitly set).
create or replace function public.sync_vehicle_eur_from_aed()
returns trigger language plpgsql as $$
declare rate constant numeric := 3.92;
begin
  if new.price_aed is not null then
    new.listed_price_eur := round(new.price_aed / rate, 2);
  end if;
  if new.reserve_price_aed is not null then
    new.reserve_price_eur := round(new.reserve_price_aed / rate, 2);
  end if;
  if new.buy_now_price_aed is not null then
    new.buy_now_price_eur := round(new.buy_now_price_aed / rate, 2);
  end if;
  return new;
end $$;

drop trigger if exists trg_vehicles_eur_from_aed on public.vehicles;
create trigger trg_vehicles_eur_from_aed
  before insert or update on public.vehicles
  for each row execute function public.sync_vehicle_eur_from_aed();

-- ---------------------------------------------------------------------
-- Task 19 — record when a vehicle sold (drives the 30-day "SOLD" window).
-- ---------------------------------------------------------------------
alter table public.vehicles add column if not exists sold_at timestamptz;

-- ---------------------------------------------------------------------
-- Task 3 — paint-thickness reading + photo per body panel.
-- ---------------------------------------------------------------------
create table if not exists public.paint_thickness_readings (
  id              uuid primary key default uuid_generate_v4(),
  vehicle_id      uuid not null references public.vehicles(id) on delete cascade,
  panel           text not null,                    -- canonical English panel key
  reading_microns numeric(8,1),
  photo_url       text,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (vehicle_id, panel)
);
create index if not exists idx_paint_thickness_vehicle on public.paint_thickness_readings(vehicle_id);

alter table public.paint_thickness_readings enable row level security;

drop policy if exists "paint readings viewable when vehicle is" on public.paint_thickness_readings;
create policy "paint readings viewable when vehicle is"
  on public.paint_thickness_readings for select
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));

drop policy if exists "staff manage paint readings" on public.paint_thickness_readings;
create policy "staff manage paint readings"
  on public.paint_thickness_readings for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------
-- Tasks 6 / 8 / 9 / 17 — invoice line items for shipping + extras, so the
-- invoice/PDF can show a full breakdown. total_eur is recomputed by the app
-- when the buyer chooses shipping/extras.
-- ---------------------------------------------------------------------
alter table public.invoices
  add column if not exists shipping_eur    numeric(12,2) not null default 0,
  add column if not exists shipping_method text,
  add column if not exists shipping_address text,
  add column if not exists extras_eur      numeric(12,2) not null default 0,
  add column if not exists extras          jsonb         not null default '[]'::jsonb;
