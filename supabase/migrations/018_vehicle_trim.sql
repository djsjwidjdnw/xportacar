-- 018 — vehicle trim/variant (e.g. "GT3", "SVJ", "EX-V6"). Captured by the
-- inspector (auto-filled from the VIN decoder when available) and shown on the
-- buyer/admin vehicle title. Free text — trims vary wildly per make. Idempotent.
alter table public.vehicles
  add column if not exists trim text;
