-- 019 — VIN decode cache + Vincario usage log (cost control for the paid
-- Vincario/vindecoder.eu source). Service-role only (the Edge Function writes
-- these with the service key, which bypasses RLS); no public policies. Idempotent.

-- Cache of decoded VINs so we never pay Vincario twice for the same VIN within
-- the freshness window (the proxy checks this BEFORE calling Vincario).
create table if not exists public.vin_decode_cache (
  vin        text primary key,
  decoded    jsonb not null,
  source     text not null,            -- 'vincario' | 'autodev' | 'nhtsa' | 'merged'
  created_at timestamptz not null default now()
);
create index if not exists idx_vin_cache_created on public.vin_decode_cache(created_at desc);

-- Append-only audit of every billable Vincario call, for monitoring spend.
create table if not exists public.vincario_usage_log (
  id              bigserial primary key,
  vin             text not null,
  called_at       timestamptz not null default now(),
  fields_returned jsonb
);
create index if not exists idx_vincario_usage_called on public.vincario_usage_log(called_at desc);

alter table public.vin_decode_cache  enable row level security;
alter table public.vincario_usage_log enable row level security;
-- No policies on purpose → only the service-role client (Edge Function) can
-- read/write. To monitor usage as an admin, query with the service role, e.g.:
--   select date_trunc('day', called_at) d, count(*) from public.vincario_usage_log group by 1 order by 1 desc;
