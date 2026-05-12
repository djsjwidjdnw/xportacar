-- =====================================================================
-- XportACar — Initial schema
-- UAE-to-EU online car auction platform
-- =====================================================================

-- Extensions ----------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================
create type user_role          as enum ('buyer', 'admin', 'inspector', 'superadmin');
create type kyc_status         as enum ('pending', 'verified', 'rejected');

create type fuel_type          as enum ('petrol', 'diesel', 'hybrid', 'electric');
create type transmission_type  as enum ('automatic', 'manual');

create type vehicle_status as enum (
  'draft',
  'inspection_scheduled',
  'inspected',
  'listed',
  'in_auction',
  'sold',
  'payment_pending',
  'paid',
  'collected',
  'shipped',
  'delivered'
);

create type photo_category as enum (
  'exterior', 'interior', 'engine', 'undercarriage', 'documents', 'damage'
);

create type damage_severity as enum ('cosmetic', 'minor', 'moderate', 'major');

create type auction_status as enum ('scheduled', 'active', 'ended', 'sold', 'cancelled');

create type notification_type as enum (
  'outbid', 'auction_won', 'auction_ending', 'new_vehicle',
  'payment_due', 'status_update'
);

-- =====================================================================
-- HELPER: updated_at trigger
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- profiles  (extends auth.users)
-- =====================================================================
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  role                  user_role   not null default 'buyer',
  company_name          text,
  company_registration  text,
  phone                 text,
  country               text,
  language              text not null default 'en',
  kyc_status            kyc_status  not null default 'pending',
  avatar_url            text,
  full_name             text,
  email                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_profiles_role    on public.profiles(role);
create index idx_profiles_country on public.profiles(country);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile when an auth.user is created -------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, company_name, country, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'country',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role helpers used in RLS -------------------------------------------
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin', 'superadmin')
  );
$$;

create or replace function public.is_staff(uid uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin', 'superadmin', 'inspector')
  );
$$;

-- =====================================================================
-- vehicles
-- =====================================================================
create table public.vehicles (
  id                  uuid primary key default uuid_generate_v4(),
  vin                 text unique not null,
  make                text not null,
  model               text not null,
  year                int  not null,
  mileage_km          int  not null default 0,
  fuel_type           fuel_type not null,
  transmission        transmission_type not null,
  drivetrain          text,
  engine              text,
  exterior_color      text,
  interior_color      text,
  body_type           text,
  first_registration  date,
  location_city       text not null default 'Dubai',
  location_country    text not null default 'UAE',
  status              vehicle_status not null default 'draft',
  seller_name         text not null,
  seller_phone        text not null,
  seller_email        text,
  inspector_id        uuid references public.profiles(id) on delete set null,
  inspection_date     timestamptz,
  inspection_notes    text,
  listed_price_eur    numeric(12,2),
  reserve_price_eur   numeric(12,2),
  buy_now_price_eur   numeric(12,2),
  description         text,
  features            text[] default '{}',
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_vehicles_status     on public.vehicles(status);
create index idx_vehicles_make_model on public.vehicles(make, model);
create index idx_vehicles_year       on public.vehicles(year);
create index idx_vehicles_price      on public.vehicles(listed_price_eur);
create index idx_vehicles_created_by on public.vehicles(created_by);

create trigger trg_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- vehicle_photos
-- =====================================================================
create table public.vehicle_photos (
  id          uuid primary key default uuid_generate_v4(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  url         text not null,
  category    photo_category not null default 'exterior',
  sort_order  int  not null default 0,
  caption     text,
  created_at  timestamptz not null default now()
);

create index idx_vehicle_photos_vehicle  on public.vehicle_photos(vehicle_id, sort_order);

-- =====================================================================
-- vehicle_damages
-- =====================================================================
create table public.vehicle_damages (
  id          uuid primary key default uuid_generate_v4(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  location    text not null,
  description text not null,
  severity    damage_severity not null default 'cosmetic',
  photo_url   text,
  created_at  timestamptz not null default now()
);

create index idx_vehicle_damages_vehicle on public.vehicle_damages(vehicle_id);

-- =====================================================================
-- auctions
-- =====================================================================
create table public.auctions (
  id                   uuid primary key default uuid_generate_v4(),
  vehicle_id           uuid not null unique references public.vehicles(id) on delete cascade,
  status               auction_status not null default 'scheduled',
  start_time           timestamptz not null,
  end_time             timestamptz not null,
  starting_price_eur   numeric(12,2) not null,
  reserve_price_eur    numeric(12,2),
  buy_now_price_eur    numeric(12,2),
  current_bid_eur      numeric(12,2),
  bid_count            int not null default 0,
  bidder_count         int not null default 0,
  winner_id            uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_auctions_status     on public.auctions(status);
create index idx_auctions_end_time   on public.auctions(end_time);
create index idx_auctions_vehicle    on public.auctions(vehicle_id);

create trigger trg_auctions_updated_at
  before update on public.auctions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- bids
-- =====================================================================
create table public.bids (
  id              uuid primary key default uuid_generate_v4(),
  auction_id      uuid not null references public.auctions(id) on delete cascade,
  bidder_id       uuid not null references public.profiles(id) on delete cascade,
  amount_eur      numeric(12,2) not null,
  is_proxy        boolean not null default false,
  proxy_max_eur   numeric(12,2),
  created_at      timestamptz not null default now()
);

create index idx_bids_auction        on public.bids(auction_id, created_at desc);
create index idx_bids_bidder         on public.bids(bidder_id, created_at desc);

-- Maintain auction.current_bid / bid_count / bidder_count -----------
create or replace function public.update_auction_on_bid()
returns trigger language plpgsql as $$
declare
  v_distinct int;
begin
  select count(distinct bidder_id) into v_distinct
  from public.bids where auction_id = new.auction_id;

  update public.auctions
  set current_bid_eur = greatest(coalesce(current_bid_eur, 0), new.amount_eur),
      bid_count       = bid_count + 1,
      bidder_count    = v_distinct,
      updated_at      = now()
  where id = new.auction_id;

  return new;
end $$;

create trigger trg_bids_update_auction
  after insert on public.bids
  for each row execute function public.update_auction_on_bid();

-- =====================================================================
-- watchlist
-- =====================================================================
create table public.watchlist (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, vehicle_id)
);

create index idx_watchlist_user on public.watchlist(user_id);

-- =====================================================================
-- notifications
-- =====================================================================
create table public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        notification_type not null,
  title       text not null,
  body        text not null,
  data        jsonb,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index idx_notifications_user_unread
  on public.notifications(user_id, read, created_at desc);

-- =====================================================================
-- Realtime publication
-- =====================================================================
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.notifications;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.vehicles         enable row level security;
alter table public.vehicle_photos   enable row level security;
alter table public.vehicle_damages  enable row level security;
alter table public.auctions         enable row level security;
alter table public.bids             enable row level security;
alter table public.watchlist        enable row level security;
alter table public.notifications    enable row level security;

-- profiles ------------------------------------------------------------
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "admins can update any profile"
  on public.profiles for update
  using (public.is_admin(auth.uid()));

-- vehicles ------------------------------------------------------------
create policy "listed vehicles are public"
  on public.vehicles for select
  using (
    status in ('listed','in_auction','sold','payment_pending','paid','collected','shipped','delivered')
    or public.is_staff(auth.uid())
  );

create policy "staff can insert vehicles"
  on public.vehicles for insert
  with check (public.is_staff(auth.uid()));

create policy "staff can update vehicles"
  on public.vehicles for update
  using (public.is_staff(auth.uid()));

create policy "admins can delete vehicles"
  on public.vehicles for delete
  using (public.is_admin(auth.uid()));

-- vehicle_photos / vehicle_damages -----------------------------------
create policy "photos viewable when parent vehicle is"
  on public.vehicle_photos for select using (
    exists (select 1 from public.vehicles v where v.id = vehicle_id)
  );
create policy "staff manage photos" on public.vehicle_photos
  for all using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create policy "damages viewable when parent vehicle is"
  on public.vehicle_damages for select using (
    exists (select 1 from public.vehicles v where v.id = vehicle_id)
  );
create policy "staff manage damages" on public.vehicle_damages
  for all using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- auctions ------------------------------------------------------------
create policy "auctions are public"
  on public.auctions for select using (true);

create policy "staff manage auctions"
  on public.auctions for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- bids ----------------------------------------------------------------
create policy "bids are public"
  on public.bids for select using (true);

create policy "authenticated users can place bids"
  on public.bids for insert
  with check (auth.uid() = bidder_id);

-- watchlist -----------------------------------------------------------
create policy "users see own watchlist"
  on public.watchlist for select using (auth.uid() = user_id);
create policy "users insert own watchlist"
  on public.watchlist for insert with check (auth.uid() = user_id);
create policy "users delete own watchlist"
  on public.watchlist for delete using (auth.uid() = user_id);

-- notifications -------------------------------------------------------
create policy "users see own notifications"
  on public.notifications for select using (auth.uid() = user_id);
create policy "users update own notifications"
  on public.notifications for update using (auth.uid() = user_id);
create policy "system inserts notifications"
  on public.notifications for insert with check (true);
