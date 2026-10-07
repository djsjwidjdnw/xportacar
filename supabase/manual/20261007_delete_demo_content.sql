-- =====================================================================
-- 2026-10-07 — DELETE the demo/test content.     *** APPLIED 2026-10-07 ***
--
-- Category: DELETES EXISTING ROWS (production data). Hand-run only.
--
-- APPLIED 2026-10-07 08:59 UTC (approved by Chase), fingerprint
-- 7634664568297872568. The three DELETEs below ran verbatim inside one DO block
-- that asserted the before/after counts equal the rehearsal (they did):
-- vehicles 2->0, auctions 2->0, bids 7->0, invoices 1->0, vehicle_photos 42->0,
-- paint_thickness_readings 10->0, notifications 22->13, profiles 13, auth.users 14.
-- Storage: remove-demo-storage-20261007.mjs --confirm removed all 53 objects.
-- Numbering: invoice_number_seq restarted (setval 1, false) -> XPC-2026-000001.
-- The recovery_20261007_* tables are KEPT.
--
-- Recovery copies already taken (applied 2026-10-07, RLS on, anon +
-- authenticated revoked): public.recovery_20261007_vehicles, _vehicle_photos,
-- _vehicle_damages, _paint_thickness_readings, _vehicle_sellers,
-- _vehicle_status_events, _vehicle_valuations, _watchlist, _shipping_quotes,
-- _auctions, _bids, _counter_offers, _invoices, _notifications,
-- _automated_email_log, _storage_objects   (16 tables, 147 rows).
--
-- Demo/test set — the only two vehicles in production:
--   d05628ec-ceb6-482a-9af5-bd76bf99dd06  2022 Mercedes-Benz AMG GT — test Buy Now by an
--        admin account (2026-06-11), 7 test bids, invoice XPC-2026-000001 (pending).
--   0210be9c-5646-4715-8392-6591f5c581f2  2014 Mercedes-Benz SLS AMG Black Series.
-- KEPT: every login (profiles + auth.users untouched), incl. the App Review
-- account inspector@xportacar.com and krause@ / simon@advisedubai.de,
-- cb@bradshawtrades.com. The admin audit log is kept as history.
--
-- Rehearsed 2026-10-07 in a rolled-back transaction on production:
--   vehicles 2->0, auctions 2->0, bids 7->0, counter_offers 0->0, invoices 1->0,
--   vehicle_photos 42->0, vehicle_damages 1->0, paint_thickness_readings 10->0,
--   vehicle_sellers 2->0, vehicle_status_events 0->0, vehicle_valuations 16->0,
--   watchlist 1->0, shipping_quotes 0->0, notifications 22->13,
--   automated_email_log 1->0, profiles 13->13, auth.users 14->14.
-- =====================================================================
begin;

-- 1. By-value references (no foreign key): notifications + automated email log.
delete from public.notifications n
 where n.data->>'vehicle_id' in ('d05628ec-ceb6-482a-9af5-bd76bf99dd06', '0210be9c-5646-4715-8392-6591f5c581f2')
    or n.data->>'auction_id' in ('d155676c-535d-4474-93da-ad5dfdf57c34', 'd2476258-9bed-4e31-8bb1-481cfdff4a54')
    or n.data->>'invoice_id' in ('ad417450-ca7b-4a78-b360-6d9576e7d325');
delete from public.automated_email_log
 where ref_id in ('d155676c-535d-4474-93da-ad5dfdf57c34', 'd2476258-9bed-4e31-8bb1-481cfdff4a54',
                  'd05628ec-ceb6-482a-9af5-bd76bf99dd06', '0210be9c-5646-4715-8392-6591f5c581f2');

-- 2. The two vehicles. ON DELETE CASCADE removes their auctions (-> bids,
--    counter_offers, invoices), vehicle_photos, vehicle_damages,
--    paint_thickness_readings, vehicle_sellers, vehicle_status_events,
--    vehicle_valuations, watchlist and shipping_quotes rows.
delete from public.vehicles
 where id in ('d05628ec-ceb6-482a-9af5-bd76bf99dd06', '0210be9c-5646-4715-8392-6591f5c581f2');

-- 3. OPTIONAL — restart invoice numbering so the first real sale is
--    XPC-<year>-000001 (the test invoice used 000001; the end-to-end test of
--    2026-10-07 consumed further numbers). Uncomment to apply:
-- select setval('invoice_number_seq', 1, false);

commit;

-- ---------------------------------------------------------------------
-- STORAGE (SQL cannot delete Storage files). After the commit above, these
-- 53 objects in bucket `vehicle-photos` are orphaned — every one is referenced
-- only by the deleted rows. Exact names: public.recovery_20261007_storage_objects.
-- Folders:
--   photos/cee0cb98-e37d-4d60-a393-e63eb19297d2/      photos/292094c2-ddf3-4005-becd-a14388533a23/
--   documents/cee0cb98-e37d-4d60-a393-e63eb19297d2/   documents/292094c2-ddf3-4005-becd-a14388533a23/
--   damages/cee0cb98-e37d-4d60-a393-e63eb19297d2/
-- Remove them with: node scripts/maintenance/remove-demo-storage-20261007.mjs --confirm
-- Already orphaned before this step (not referenced by any row, listed only):
--   payment-proofs/977d42cd-c392-4399-91f3-1339efefba71/1781596039357-1000124459.jpg
-- ---------------------------------------------------------------------
