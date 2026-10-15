-- =====================================================================
-- 2026-10-15 — RECOVERY COPY of the App Review demo listing before deletion.
-- *** APPLIED 2026-10-15: 7 tables, 51 rows (vehicles 1, vehicle_photos 20,
-- paint_thickness_readings 6, vehicle_valuations 2, auctions 1,
-- admin_audit_log 1, storage_objects 20). ***
-- Pre-approved cleanup (Chase, 2026-10-09: after BOTH 1.0.2 versions are
-- approved; they are live as of 2026-10-15). Additive: creates tables and
-- copies rows; changes nothing in the source tables. The matching delete is
-- supabase/manual/20261015_delete_demo_listing.sql.
--
-- Demo listing: vehicle 5f4e3424-89fa-43e8-b05d-d9fe795e31ff ("2019 Mercedes-Benz
-- AMG GT C Roadster — Demo listing for App Review, not for sale"), auction
-- 84326b8b-7140-40df-bf21-69f97da3e2a5 (ended 2026-10-14, no buyer).
-- Inventory 2026-10-15: 20 photos, 6 paint readings (no photo files), 2 cached
-- valuations, the listing row, 1 audit row (publish_listing), 20 Storage
-- objects. No bids, invoices, payment proofs, damages, seller rows, status
-- events, watchlist, quotes, counter-offers, notifications or email-log rows.
-- The reviewer accounts created nothing else (no uploads since 2026-10-07, no
-- other vehicles). The accounts themselves are kept for future reviews.
--
-- Every recovery table: RLS on with no policies, all privileges revoked from
-- anon + authenticated (admin-only; same as recovery_20261007_*), service_role
-- kept so a restore can run. Restore = insert into public.<t> select * from
-- public.recovery_20261015_<t> (vehicles, then auctions, then the rest).
-- =====================================================================
begin;

create temp table _demo_v on commit drop as select '5f4e3424-89fa-43e8-b05d-d9fe795e31ff'::uuid as id;
create temp table _demo_a on commit drop as select id from public.auctions where vehicle_id in (select id from _demo_v);

create table if not exists public.recovery_20261015_vehicles                 as select * from public.vehicles                 where id in (select id from _demo_v);
create table if not exists public.recovery_20261015_vehicle_photos           as select * from public.vehicle_photos           where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261015_paint_thickness_readings as select * from public.paint_thickness_readings where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261015_vehicle_valuations       as select * from public.vehicle_valuations       where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261015_auctions                 as select * from public.auctions                 where id in (select id from _demo_a);
create table if not exists public.recovery_20261015_admin_audit_log          as select * from public.admin_audit_log
  where entity_id in (select id from _demo_v union select id from _demo_a);
-- Storage: object metadata (names, sizes). The 20 files were also downloaded to
-- a local backup before deletion; they are licensed stock photos
-- (docs/app-store/demo-photo-credits.md).
create table if not exists public.recovery_20261015_storage_objects as
  select o.* from storage.objects o
   where o.bucket_id = 'vehicle-photos'
     and o.name in (select substring(url from '/object/public/vehicle-photos/(.+)$')
                      from public.vehicle_photos where vehicle_id in (select id from _demo_v));

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'recovery_20261015_%' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

commit;
