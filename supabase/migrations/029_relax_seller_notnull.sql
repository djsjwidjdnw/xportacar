-- 029_relax_seller_notnull.sql   (PRE-DEPLOY — apply BEFORE the repoint deploy)
--
-- The seller-PII repoint moves all staff writes onto vehicle_sellers and STOPS
-- populating vehicles.seller_name / seller_phone. Those columns are NOT NULL
-- (migration 001), so a vehicle insert that omits them would fail. Relax the
-- constraints so staff inserts succeed with the seller columns omitted.
--
-- Backward-compatible: the still-deployed pre-repoint app keeps writing values
-- into the now-nullable columns without error, so this is safe to apply while
-- the old code is live.
--
-- APPLY ORDER for the seller-PII cutover:
--   1. Apply THIS (029_relax_seller_notnull).
--   2. Deploy the repoint (web push + inspector OTA); wait for Vercel "Ready".
--   3. Apply 030_lock_seller_pii (drops the trigger, function, and columns).

alter table public.vehicles alter column seller_name  drop not null;
alter table public.vehicles alter column seller_phone drop not null;
