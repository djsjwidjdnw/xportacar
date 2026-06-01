-- Regional market specification for a vehicle (e.g. "GCC Specs", "European
-- Specs", "Japanese Specs", or a free-text "Other" value). Captured by the
-- inspector app (step 1 — Details) and shown on the buyer/admin specs grid
-- (src/components/vehicle/SpecsGrid.tsx). Free-text so "Other" is allowed.
-- Idempotent.
alter table public.vehicles
  add column if not exists market_spec text;
