-- One-off cleanup of demo/seed data before going live.
-- Deletes demo vehicles (and everything tied to them) but KEEPS all user
-- accounts (profiles / auth.users). Run once in the Supabase SQL editor.
--
-- A vehicle is treated as demo if its VIN looks seeded OR it carries the
-- deterministic seed UUID prefix used by supabase/seed.sql.
begin;

create temporary table _demo_vehicles on commit drop as
  select id from public.vehicles
  where vin ilike 'SEED%'
     or vin ilike 'INSPECT%'
     or vin like '%0000000%'
     or id::text like '11111111-0001-%';

create temporary table _demo_auctions on commit drop as
  select id from public.auctions
  where vehicle_id in (select id from _demo_vehicles)
     or id::text like '22222222-0001-%';

-- Children first (FK-safe), then auctions, then vehicles.
delete from public.bids           where auction_id in (select id from _demo_auctions);
delete from public.invoices       where auction_id in (select id from _demo_auctions);
delete from public.counter_offers where auction_id in (select id from _demo_auctions);
delete from public.watchlist        where vehicle_id in (select id from _demo_vehicles);
delete from public.shipping_quotes  where vehicle_id in (select id from _demo_vehicles);
delete from public.vehicle_photos   where vehicle_id in (select id from _demo_vehicles);
delete from public.vehicle_damages  where vehicle_id in (select id from _demo_vehicles);
-- Demo notifications reference the auction/vehicle id inside the JSON `data`.
delete from public.notifications
  where (data->>'auction_id') in (select id::text from _demo_auctions)
     or (data->>'vehicle_id') in (select id::text from _demo_vehicles);

delete from public.auctions where id in (select id from _demo_auctions);
delete from public.vehicles where id in (select id from _demo_vehicles);

-- Counters: auctions.bid_count / bidder_count are kept in sync by triggers,
-- so the remaining (real) auctions are already correct. The invoice number
-- sequence is intentionally NOT reset to keep invoice numbers monotonic.

commit;
