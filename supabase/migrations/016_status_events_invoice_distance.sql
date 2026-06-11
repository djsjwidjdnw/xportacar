-- =====================================================================
-- 016 — lifecycle status-event history (+ notes/photos) and the invoice
--        shipping-distance column for the door-to-door buy-now flow.
-- Idempotent.
-- =====================================================================

-- Task 1 — door-to-door distance recorded on the invoice for the breakdown/PDF.
alter table public.invoices
  add column if not exists shipping_distance_km integer;

-- Task 6 — per-transition history for the sold→picked_up→in_transit→delivered
-- lifecycle. One row per transition, with an optional note + photo the admin
-- can attach (tracking info, pickup/delivery confirmation). The buyer timeline
-- reads this; the vehicle's CURRENT status still lives on vehicles.status.
create table if not exists public.vehicle_status_events (
  id          uuid primary key default uuid_generate_v4(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  status      vehicle_status not null,
  note        text,
  photo_url   text,
  actor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_status_events_vehicle on public.vehicle_status_events(vehicle_id, created_at);

alter table public.vehicle_status_events enable row level security;

-- Read: the winning buyer of the vehicle's auction, or any staff.
drop policy if exists "status events visible to buyer or staff" on public.vehicle_status_events;
create policy "status events visible to buyer or staff"
  on public.vehicle_status_events for select to authenticated
  using (
    public.is_staff(auth.uid())
    or exists (
      select 1 from public.auctions a
      where a.vehicle_id = vehicle_status_events.vehicle_id
        and a.winner_id = auth.uid()
    )
  );

-- Write: staff only (admin transition buttons use the service role anyway).
drop policy if exists "staff insert status events" on public.vehicle_status_events;
create policy "staff insert status events"
  on public.vehicle_status_events for insert to authenticated
  with check (public.is_staff(auth.uid()));

-- Task 4 — dedup log for the automated email cron jobs (watchlist new-match,
-- auction-ending-soon). The Edge Functions consult this to enforce "max 1
-- watchlist email per user per day" and "1 ending-soon email per user per
-- auction". Service-role only (cron); no RLS policies needed beyond enabling.
create table if not exists public.automated_email_log (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid references public.profiles(id) on delete cascade,
  kind     text not null,              -- 'watchlist_match' | 'auction_ending'
  ref_id   uuid,                       -- vehicle_id / auction_id
  sent_at  timestamptz not null default now()
);
create index if not exists idx_auto_email_user_kind on public.automated_email_log(user_id, kind, sent_at desc);
create unique index if not exists uq_auto_email_user_kind_ref
  on public.automated_email_log(user_id, kind, ref_id);
alter table public.automated_email_log enable row level security;
-- (No policies → only the service-role client, which bypasses RLS, can touch it.)
