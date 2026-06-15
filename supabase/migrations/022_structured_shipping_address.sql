-- 022 — structured door-to-door delivery address on invoices.
--
-- Door-to-door shipping needs a real street address, not just a "nearest city".
-- shipping_address (free text) and shipping_distance_km already exist (015/016);
-- this adds the structured fields + geocoded coordinates captured from the
-- address autofill. Idempotent.

alter table public.invoices
  add column if not exists shipping_line1       text,
  add column if not exists shipping_line2       text,
  add column if not exists shipping_city        text,
  add column if not exists shipping_postal_code text,
  add column if not exists shipping_country     text,   -- ISO 3166-1 alpha-2
  add column if not exists shipping_latitude    numeric,
  add column if not exists shipping_longitude   numeric;
