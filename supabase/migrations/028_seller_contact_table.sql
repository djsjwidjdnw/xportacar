-- 028_seller_contact_table.sql   (PART 1 of 2 — NON-DESTRUCTIVE, safe to apply)
-- Move seller identity/contact off the buyer-readable vehicles table so it can
-- be enforced staff-only at the DATA layer (Postgres RLS is row-level, not
-- column-level, and vehicles rows are readable by anon + any buyer, so the
-- seller_* columns leak today for every listed/in_auction/... vehicle).
--
-- This part creates a staff-only child table and back-fills it. It does NOT yet
-- drop the columns from vehicles, so nothing breaks: admin/inspector code keeps
-- reading vehicles.seller_* exactly as before. The buyer web/app were already
-- changed to never select seller_* (see the same batch's commits).
--
-- ROLLOUT (do NOT skip the middle step):
--   1. Apply THIS migration (028).
--   2. Deploy the admin/inspector app repoint to read/write vehicle_sellers
--      (see report — held until you confirm 028 is applied).
--   3. Apply 029_lock_seller_pii.sql to drop the columns from vehicles.
--
-- is_staff = admin | superadmin | inspector.

create table if not exists public.vehicle_sellers (
  vehicle_id   uuid primary key references public.vehicles(id) on delete cascade,
  seller_name  text,
  seller_phone text,
  seller_email text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Back-fill from the existing columns (idempotent).
insert into public.vehicle_sellers (vehicle_id, seller_name, seller_phone, seller_email)
  select id, seller_name, seller_phone, seller_email
  from public.vehicles
on conflict (vehicle_id) do update
  set seller_name  = excluded.seller_name,
      seller_phone = excluded.seller_phone,
      seller_email = excluded.seller_email,
      updated_at   = now();

alter table public.vehicle_sellers enable row level security;

-- Staff-only, at the data layer. Buyers/anon get zero rows even via a raw
-- PostgREST call, because they are not is_staff.
drop policy if exists "seller contact readable by staff" on public.vehicle_sellers;
create policy "seller contact readable by staff"
  on public.vehicle_sellers for select
  using (public.is_staff(auth.uid()));

drop policy if exists "seller contact writable by staff" on public.vehicle_sellers;
create policy "seller contact writable by staff"
  on public.vehicle_sellers for all
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Keep vehicle_sellers in step with the service-role inserts that create a
-- vehicle (admin create / inspection). Ensures a row always exists to update.
create or replace function public.sync_vehicle_seller()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.vehicle_sellers (vehicle_id, seller_name, seller_phone, seller_email)
  values (new.id, new.seller_name, new.seller_phone, new.seller_email)
  on conflict (vehicle_id) do update
    set seller_name  = excluded.seller_name,
        seller_phone = excluded.seller_phone,
        seller_email = excluded.seller_email,
        updated_at   = now();
  return new;
end $$;

-- NOTE: this trigger reads NEW.seller_* which still exist in PART 1. It is
-- DROPPED in 029 (once those columns are gone) — from then on the app writes
-- vehicle_sellers directly.
drop trigger if exists trg_sync_vehicle_seller on public.vehicles;
create trigger trg_sync_vehicle_seller
  after insert or update of seller_name, seller_phone, seller_email on public.vehicles
  for each row execute function public.sync_vehicle_seller();
