-- =====================================================================
-- 003_scale_indexes_rls.sql
-- Scale-readiness pass for 100k+ users and 100k+ vehicles.
--   • Adds the indexes that 001/002 didn't already create.
--   • Tightens RLS so inspectors only see vehicles assigned to them.
-- Safe to run repeatedly: every index uses CREATE INDEX IF NOT EXISTS and
-- every policy is DROP ... IF EXISTS before CREATE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------
-- Already present from 001/002 (kept here as a checklist — NOT recreated):
--   vehicles(status), vehicles(make, model)  [covers make-only filters],
--   vehicles(year), vehicles(listed_price_eur), vehicles(created_by),
--   auctions(status), auctions(end_time), auctions(vehicle_id),
--   bids(auction_id, created_at desc), bids(bidder_id, created_at desc),
--   watchlist(user_id) + unique(user_id, vehicle_id),
--   vehicle_photos(vehicle_id, sort_order), vehicle_damages(vehicle_id),
--   profiles(role), profiles(country),
--   notifications(user_id, read, created_at desc),
--   invoices(buyer_id, created_at desc), invoices(status),
--   counter_offers(auction_id, status), counter_offers(bidder_id, created_at desc),
--   saved_searches(user_id, created_at desc).

-- vehicles: marketplace facet filters + inspector dashboard
create index if not exists idx_vehicles_fuel_type        on public.vehicles(fuel_type);
create index if not exists idx_vehicles_transmission      on public.vehicles(transmission);
create index if not exists idx_vehicles_inspector         on public.vehicles(inspector_id);
-- Inspector dashboard filters inspector_id + status together.
create index if not exists idx_vehicles_inspector_status  on public.vehicles(inspector_id, status);
-- Marketplace lists status in (listed, in_auction) ordered by recency.
create index if not exists idx_vehicles_status_created    on public.vehicles(status, created_at desc);

-- auctions: buyer dashboard "won auctions" (winner_id + status)
create index if not exists idx_auctions_winner           on public.auctions(winner_id);

-- watchlist: reverse lookup + prune-by-vehicle (unique index only covers the
-- user_id prefix, not vehicle_id alone).
create index if not exists idx_watchlist_vehicle         on public.watchlist(vehicle_id);

-- profiles: email lookups (inspector seeding, admin search)
create index if not exists idx_profiles_email            on public.profiles(email);

-- notifications: "latest N for user" without the read predicate
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);

-- invoices: "you won" page looks up by auction_id (+ buyer)
create index if not exists idx_invoices_auction          on public.invoices(auction_id, buyer_id);

-- ---------------------------------------------------------------------
-- RLS — scope inspectors to their own vehicles
-- ---------------------------------------------------------------------
-- 001's "listed vehicles are public" granted EVERY staff member (incl. all
-- inspectors) SELECT on all non-public vehicles. At scale we want an
-- inspector to see only vehicles assigned to them (or that they created);
-- admins keep full visibility; public statuses stay public for browsing.
-- vehicle_photos / vehicle_damages inherit this through their EXISTS check
-- against the vehicles table, so they tighten automatically.
drop policy if exists "listed vehicles are public" on public.vehicles;
drop policy if exists "vehicles visible per role"  on public.vehicles;
create policy "vehicles visible per role"
  on public.vehicles for select
  using (
    status in ('listed','in_auction','sold','payment_pending','paid','collected','shipped','delivered')
    or public.is_admin(auth.uid())
    or inspector_id = auth.uid()
    or created_by   = auth.uid()
  );

-- Insert / update / delete policies from 001 are unchanged:
--   "staff can insert vehicles", "staff can update vehicles",
--   "admins can delete vehicles".

-- ---------------------------------------------------------------------
-- RLS sanity checklist (already enforced by 001/002 — no change needed):
--   • bids:        SELECT public (live bid history is a product feature);
--                  INSERT only with check (auth.uid() = bidder_id) → anon
--                  users can browse but cannot bid.
--   • watchlist:   SELECT/INSERT/DELETE all gated on auth.uid() = user_id.
--   • invoices:    SELECT/UPDATE gated on auth.uid() = buyer_id (or staff).
--   • auctions:    SELECT public (browsing); writes staff-only.
--   • notifications/saved_searches/kyc/push_tokens: owner-scoped.
-- =====================================================================
