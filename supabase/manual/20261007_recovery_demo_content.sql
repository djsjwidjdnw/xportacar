-- =====================================================================
-- 2026-10-07 — RECOVERY COPY of the demo/test content before deletion.
-- APPLIED by Claude (additive: creates tables, copies rows, changes nothing
-- in the source tables). The matching delete is
-- supabase/manual/20261007_delete_demo_content.sql — NOT applied.
--
-- Demo/test set (the only two vehicles in production):
--   d05628ec-ceb6-482a-9af5-bd76bf99dd06  2022 Mercedes-Benz AMG GT (test Buy Now
--                                          by an admin, 2026-06-11, invoice XPC-2026-000001)
--   0210be9c-5646-4715-8392-6591f5c581f2  2014 Mercedes-Benz SLS AMG Black Series
--
-- Every recovery table: RLS enabled with NO policies, all privileges revoked
-- from anon + authenticated (admin-only — the grants rule's anon/authenticated
-- lines are deliberately omitted), service_role kept so a restore can run.
-- Restore = insert into public.<t> select * from public.recovery_20261007_<t>
-- (parents first: vehicles, auctions, invoices, then children).
-- =====================================================================
begin;

create temp table _demo_v on commit drop as
  select unnest(array['d05628ec-ceb6-482a-9af5-bd76bf99dd06','0210be9c-5646-4715-8392-6591f5c581f2']::uuid[]) as id;
create temp table _demo_a on commit drop as select id from public.auctions where vehicle_id in (select id from _demo_v);
create temp table _demo_i on commit drop as select id from public.invoices where vehicle_id in (select id from _demo_v) or auction_id in (select id from _demo_a);

create table if not exists public.recovery_20261007_vehicles                 as select * from public.vehicles                 where id in (select id from _demo_v);
create table if not exists public.recovery_20261007_vehicle_photos           as select * from public.vehicle_photos           where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_vehicle_damages          as select * from public.vehicle_damages          where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_paint_thickness_readings as select * from public.paint_thickness_readings where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_vehicle_sellers          as select * from public.vehicle_sellers          where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_vehicle_status_events    as select * from public.vehicle_status_events    where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_vehicle_valuations       as select * from public.vehicle_valuations       where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_watchlist                as select * from public.watchlist                where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_shipping_quotes          as select * from public.shipping_quotes          where vehicle_id in (select id from _demo_v);
create table if not exists public.recovery_20261007_auctions                 as select * from public.auctions                 where id in (select id from _demo_a);
create table if not exists public.recovery_20261007_bids                     as select * from public.bids                     where auction_id in (select id from _demo_a);
create table if not exists public.recovery_20261007_counter_offers           as select * from public.counter_offers           where auction_id in (select id from _demo_a);
create table if not exists public.recovery_20261007_invoices                 as select * from public.invoices                 where id in (select id from _demo_i);
create table if not exists public.recovery_20261007_notifications            as select * from public.notifications n
  where n.data->>'vehicle_id' in (select id::text from _demo_v)
     or n.data->>'auction_id' in (select id::text from _demo_a)
     or n.data->>'invoice_id' in (select id::text from _demo_i);
create table if not exists public.recovery_20261007_automated_email_log     as select * from public.automated_email_log
  where ref_id in (select id from _demo_a union select id from _demo_v);
-- Storage: object metadata only (file bytes stay in Storage until removed via the API).
create table if not exists public.recovery_20261007_storage_objects as
  select o.* from storage.objects o
  where o.bucket_id = 'vehicle-photos' and o.name in (
          select substring(u from '/object/public/vehicle-photos/(.+)$') from (
            select url as u from public.vehicle_photos where vehicle_id in (select id from _demo_v)
            union select photo_url from public.vehicle_damages where vehicle_id in (select id from _demo_v)
            union select photo_url from public.paint_thickness_readings where vehicle_id in (select id from _demo_v)
          ) s where u is not null)
     or (o.bucket_id = 'payment-proofs' and split_part(o.name, '/', 1) in (select id::text from _demo_i));

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'recovery_20261007_%' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

commit;
