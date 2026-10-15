-- =====================================================================
-- 2026-10-15 — DELETE the App Review demo listing.     *** APPLIED 2026-10-15 ***
-- Category: DELETES EXISTING ROWS (production data). Pre-approved by Chase
-- (2026-10-09) for after both 1.0.2 versions are approved. Run only after
-- 20261015_recovery_demo_listing.sql.
--
-- APPLIED 2026-10-15 (cluster 7634664568297872568), after a rolled-back
-- rehearsal that matched: vehicles 1->0, auctions 1->0, vehicle_photos 20->0,
-- paint_thickness_readings 6->0, vehicle_valuations 2->0, admin_audit_log 3->2,
-- invoices 0->0, profiles 14->14, auth.users 15->15 (reviewer logins kept).
-- Storage: remove-demo-storage-20261015.mjs --confirm removed the 20 objects
-- (vehicle-photos 21->1). invoice_number_seq set to (1, false): the next invoice
-- is XPC-2026-000001. Recovery tables recovery_20261015_* (7, 51 rows) are KEPT.
--
-- The DO block asserts the counts recorded on 2026-10-15 before deleting and
-- that nothing of the listing is left afterwards; any mismatch aborts and
-- rolls back.
-- =====================================================================
begin;

do $$
declare
  v uuid := '5f4e3424-89fa-43e8-b05d-d9fe795e31ff';
  a uuid := '84326b8b-7140-40df-bf21-69f97da3e2a5';
  n int;
begin
  -- Recovery copies must exist first.
  select count(*) into n from public.recovery_20261015_vehicles where id = v;
  if n <> 1 then raise exception 'recovery copy missing (vehicles=%)', n; end if;
  select count(*) into n from public.recovery_20261015_vehicle_photos where vehicle_id = v;
  if n <> 20 then raise exception 'recovery copy missing (vehicle_photos=%)', n; end if;

  -- Expected before-state.
  if (select count(*) from public.vehicles) <> 1 then raise exception 'unexpected vehicles count'; end if;
  if (select count(*) from public.vehicle_photos where vehicle_id = v) <> 20 then raise exception 'unexpected photos'; end if;
  if (select count(*) from public.paint_thickness_readings where vehicle_id = v) <> 6 then raise exception 'unexpected paint readings'; end if;
  if (select count(*) from public.invoices) <> 0 then raise exception 'an invoice exists; stop'; end if;

  -- 1. By-value references (no foreign key).
  delete from public.admin_audit_log where entity_id in (v, a);
  delete from public.notifications nn where nn.data->>'vehicle_id' = v::text or nn.data->>'auction_id' = a::text;
  delete from public.automated_email_log where ref_id in (v, a);

  -- 2. The vehicle. ON DELETE CASCADE removes its auction (and bids, counter
  --    offers, invoices), photos, paint readings, cached valuations and any
  --    other per-vehicle rows.
  delete from public.vehicles where id = v;

  -- After-state.
  if exists (select 1 from public.vehicles where id = v) then raise exception 'vehicle still there'; end if;
  if exists (select 1 from public.auctions where id = a) then raise exception 'auction still there'; end if;
  if exists (select 1 from public.vehicle_photos where vehicle_id = v) then raise exception 'photos still there'; end if;
  if exists (select 1 from public.paint_thickness_readings where vehicle_id = v) then raise exception 'paint readings still there'; end if;
  if exists (select 1 from public.vehicle_valuations where vehicle_id = v) then raise exception 'valuations still there'; end if;
end $$;

commit;

-- 3. Restart invoice numbering so the first real invoice is XPC-2026-000001
--    (no invoice exists; asserted above). Sequences are not transactional.
select setval('public.invoice_number_seq', 1, false);

-- 4. Storage (SQL cannot delete Storage files): the 20 demo photos in bucket
--    vehicle-photos, folder photos/e4babec5-de24-45bc-acb1-a25d6286307b/, names in
--    public.recovery_20261015_storage_objects. Remove with:
--    node scripts/maintenance/remove-demo-storage-20261015.mjs --confirm
