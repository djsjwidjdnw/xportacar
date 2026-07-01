-- 029_lock_seller_pii.sql   (PART 2 of 2 — DESTRUCTIVE, do NOT run early)
--
-- ⚠️  DO NOT APPLY until BOTH are true:
--     (a) 028_seller_contact_table.sql has been applied, AND
--     (b) the admin/inspector app repoint (reads+writes now target
--         vehicle_sellers, not vehicles.seller_*) is DEPLOYED to production.
--     Applying this before (b) will break admin vehicle detail (seller shows
--     blank) and admin/inspector create/edit (writing seller_* errors — column
--     gone). The buyer web/app are already safe (they never select seller_*).
--
-- This permanently removes seller identity/contact from the buyer-readable
-- vehicles table. After this, seller PII lives ONLY in vehicle_sellers, which is
-- staff-only RLS — so a raw PostgREST call by any buyer/anon returns nothing.

-- The sync trigger is no longer needed: with the columns gone, the app writes
-- vehicle_sellers directly.
drop trigger if exists trg_sync_vehicle_seller on public.vehicles;
drop function if exists public.sync_vehicle_seller();

alter table public.vehicles
  drop column if exists seller_name,
  drop column if exists seller_phone,
  drop column if exists seller_email;
