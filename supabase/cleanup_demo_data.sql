-- =====================================================================
-- XportACar — PRODUCTION DEMO-DATA CLEANUP
-- =====================================================================
-- WHEN TO RUN
--   ONCE, immediately before public launch — AFTER you have taken a database
--   backup (Supabase Dashboard → Database → Backups) and ideally in the same
--   maintenance window in which you wipe demo files from Storage (see the
--   "STORAGE" section at the bottom — SQL cannot touch Storage objects).
--
-- WHAT IT DOES
--   1. Deletes every demo / seed VEHICLE and AUCTION and all rows tied to
--      them (photos, damages, valuations).  Demo data is identified by the
--      deterministic seed UUID prefixes used by supabase/seed.sql,
--      seed_demo_porsche.sql and seed_demo_inspection.sql:
--          vehicles  → id like '11111111-%'   (0001 = main seed + Porsche,
--                                               0002 = inspector demo G63)
--          auctions  → id like '22222222-%'
--      plus a VIN heuristic for hand-seeded rows.
--   2. KEEPS all user accounts (public.profiles + auth.users untouched) but
--      RESETS their activity to a clean slate: watchlist, bids, counter
--      offers, invoices (incl. payment-proof references), saved searches,
--      shipping quotes, push tokens, KYC submissions, notifications and the
--      admin audit log are all cleared, and profiles.kyc_status is reset to
--      'pending'.  (Pre-launch ALL activity is demo/test, so this reset is
--      global by design — see the WARNING below before running on a DB that
--      already has real customers.)
--   3. Resets the invoice-number sequence so the first real sale is
--      XPC-<year>-000001.
--   4. Is FULLY IDEMPOTENT — safe to run any number of times.  Every table
--      touched is existence-guarded, so it also works if an optional
--      migration was never applied.
--   5. Prints a per-table summary of what it deleted (RAISE NOTICE — look at
--      the "Messages"/"Notices" tab of the SQL editor).
--
-- HOW TO RUN
--   Supabase Dashboard → SQL Editor → paste this whole file → Run.
--   (CLI alternative:  psql "$DATABASE_URL" -f supabase/cleanup_demo_data.sql)
--
-- WARNING
--   The user-activity reset in step 2 is GLOBAL (it clears bids/invoices/etc.
--   for every account, not just demo rows) because it is meant to be run on a
--   pre-launch database that has only test activity.  Do NOT run it as-is on a
--   database that already contains paying customers — comment out the "USER
--   ACTIVITY RESET" block first.
-- =====================================================================

begin;

do $$
declare
  c_vehicles   int := 0;
  c_auctions   int := 0;
  c_photos     int := 0;
  c_damages    int := 0;
  c_valuations int := 0;
  c_bids       int := 0;
  c_counter    int := 0;
  c_invoices   int := 0;
  c_watchlist  int := 0;
  c_saved      int := 0;
  c_shipping   int := 0;
  c_push       int := 0;
  c_kyc        int := 0;
  c_notif      int := 0;
  c_audit      int := 0;
  c_kyc_reset  int := 0;
  n int;
begin
  -- ---------------------------------------------------------------
  -- Identify the demo vehicles + auctions (deterministic seed IDs).
  -- ---------------------------------------------------------------
  create temporary table _demo_vehicles on commit drop as
    select id from public.vehicles
    where id::text like '11111111-%'
       or vin ilike 'SEED%'
       or vin ilike 'INSPECT%'
       or vin like '%0000000%'
       or vin in ('WP0AB2A99NS227001', 'WDC4632F6PX998877');

  create temporary table _demo_auctions on commit drop as
    select id from public.auctions
    where id::text like '22222222-%'
       or vehicle_id in (select id from _demo_vehicles);

  select count(*) into c_vehicles from _demo_vehicles;
  select count(*) into c_auctions from _demo_auctions;

  -- ===============================================================
  -- USER ACTIVITY RESET (global — see WARNING in the header).
  -- Keeps accounts, clears everything they did. Children first so
  -- FK constraints are satisfied even without ON DELETE CASCADE.
  -- ===============================================================
  if to_regclass('public.bids') is not null then
    delete from public.bids;            get diagnostics n = row_count; c_bids := n;
  end if;
  if to_regclass('public.counter_offers') is not null then
    delete from public.counter_offers;  get diagnostics n = row_count; c_counter := n;
  end if;
  if to_regclass('public.invoices') is not null then
    -- payment_proof_urls / payment_proof_note live on this row, so deleting
    -- the invoice also drops every payment-proof *reference* (the files in
    -- Storage are removed separately — see the STORAGE section).
    delete from public.invoices;        get diagnostics n = row_count; c_invoices := n;
  end if;
  if to_regclass('public.watchlist') is not null then
    delete from public.watchlist;       get diagnostics n = row_count; c_watchlist := n;
  end if;
  if to_regclass('public.saved_searches') is not null then
    delete from public.saved_searches;  get diagnostics n = row_count; c_saved := n;
  end if;
  if to_regclass('public.shipping_quotes') is not null then
    delete from public.shipping_quotes; get diagnostics n = row_count; c_shipping := n;
  end if;
  if to_regclass('public.push_tokens') is not null then
    delete from public.push_tokens;     get diagnostics n = row_count; c_push := n;
  end if;
  if to_regclass('public.kyc_submissions') is not null then
    delete from public.kyc_submissions; get diagnostics n = row_count; c_kyc := n;
  end if;
  if to_regclass('public.notifications') is not null then
    delete from public.notifications;   get diagnostics n = row_count; c_notif := n;
  end if;
  if to_regclass('public.admin_audit_log') is not null then
    delete from public.admin_audit_log; get diagnostics n = row_count; c_audit := n;
  end if;

  -- Reset every account's KYC back to pending (fresh start at launch).
  if to_regclass('public.profiles') is not null then
    update public.profiles set kyc_status = 'pending'
      where kyc_status is distinct from 'pending';
    get diagnostics n = row_count; c_kyc_reset := n;
  end if;

  -- ===============================================================
  -- DEMO VEHICLES + AUCTIONS (and their non-activity children).
  -- Bids/invoices/counter-offers/watchlist/shipping for these were
  -- already removed by the global reset above; here we drop the
  -- vehicle-bound content rows and then the parents themselves.
  -- ===============================================================
  if to_regclass('public.vehicle_photos') is not null then
    delete from public.vehicle_photos where vehicle_id in (select id from _demo_vehicles);
    get diagnostics n = row_count; c_photos := n;
  end if;
  if to_regclass('public.vehicle_damages') is not null then
    delete from public.vehicle_damages where vehicle_id in (select id from _demo_vehicles);
    get diagnostics n = row_count; c_damages := n;
  end if;
  if to_regclass('public.vehicle_valuations') is not null then
    delete from public.vehicle_valuations where vehicle_id in (select id from _demo_vehicles);
    get diagnostics n = row_count; c_valuations := n;
  end if;

  delete from public.auctions where id in (select id from _demo_auctions);
  delete from public.vehicles where id in (select id from _demo_vehicles);

  -- ===============================================================
  -- SEQUENCES / COUNTERS
  --   • invoice_number_seq → restart at 1 so the first real invoice is
  --     XPC-<year>-000001 (all invoices were just deleted).
  --   • auctions.bid_count / bidder_count are maintained by triggers and
  --     are already correct now that demo auctions are gone — no reset
  --     needed.
  -- ===============================================================
  if to_regclass('public.invoice_number_seq') is not null then
    perform setval('public.invoice_number_seq', 1, false);
  end if;

  -- ---------------------------------------------------------------
  -- Summary.
  -- ---------------------------------------------------------------
  raise notice '====================================================';
  raise notice 'XportACar demo-data cleanup complete.';
  raise notice '----------------------------------------------------';
  raise notice 'Demo vehicles deleted .............. %', c_vehicles;
  raise notice 'Demo auctions deleted ............. %', c_auctions;
  raise notice '  vehicle_photos deleted .......... %', c_photos;
  raise notice '  vehicle_damages deleted ......... %', c_damages;
  raise notice '  vehicle_valuations deleted ...... %', c_valuations;
  raise notice 'User activity reset (all accounts kept):';
  raise notice '  bids cleared .................... %', c_bids;
  raise notice '  counter_offers cleared .......... %', c_counter;
  raise notice '  invoices cleared ................ %', c_invoices;
  raise notice '  watchlist cleared ............... %', c_watchlist;
  raise notice '  saved_searches cleared .......... %', c_saved;
  raise notice '  shipping_quotes cleared ......... %', c_shipping;
  raise notice '  push_tokens cleared ............. %', c_push;
  raise notice '  kyc_submissions cleared ......... %', c_kyc;
  raise notice '  notifications cleared ........... %', c_notif;
  raise notice '  admin_audit_log cleared ......... %', c_audit;
  raise notice '  profiles reset to kyc=pending ... %', c_kyc_reset;
  raise notice 'invoice_number_seq reset to 1.';
  raise notice '====================================================';
  raise notice 'NEXT: wipe demo files from Storage (SQL cannot — see';
  raise notice 'the STORAGE section at the bottom of this file).';
  raise notice '====================================================';
end $$;

commit;

-- =====================================================================
-- STORAGE  (must be done OUTSIDE SQL)
-- =====================================================================
-- Storage objects live in Supabase Storage, NOT in Postgres, so this SQL
-- script cannot delete them.  Remove demo files via the Dashboard or the
-- Storage API with the service-role key.
--
-- Buckets and what to clear:
--   • vehicle-photos  (PUBLIC)  — inspector-uploaded photos/documents from
--       test inspections, plus any legacy payment proofs.  Demo paths:
--          photos/{user_id}/...        documents/{user_id}/...
--          invoices/{invoice_id}/payment_proof/...
--       Do NOT delete the _internal/ prefix — that holds platform-settings
--       JSON the web app needs at runtime.
--       (The seed.sql / seed_demo_porsche.sql vehicles use hosted Unsplash
--        URLs, so they have NO objects in this bucket — only real uploads do.)
--   • payment-proofs  (PRIVATE) — every object is a demo payment proof.
--       Path: {invoice_id}/{filename}.  Safe to empty the whole bucket.
--
-- Dashboard route:  Storage → <bucket> → select demo folders → Delete.
--
-- Scripted route (service-role key, run from the web repo):
--   node -e "const{createClient}=require('@supabase/supabase-js');
--     const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,
--       process.env.SUPABASE_SERVICE_ROLE_KEY);
--     (async()=>{for(const b of ['payment-proofs']){
--       const {data}=await s.storage.from(b).list('',{limit:1000});
--       /* recurse folders + remove() — see docs/LAUNCH_CHECKLIST.md */ }})()"
--   The launch checklist (docs/LAUNCH_CHECKLIST.md) has the full delete recipe.
-- =====================================================================
