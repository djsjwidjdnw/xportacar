-- =====================================================================
-- 031 — Fixed-price marketplace mode.
--
-- The platform sells at a fixed price (auctions.buy_now_price_eur, bought via
-- the existing buy_now() RPC). Bidding is NOT deleted: it sits behind one flag,
-- app_settings.bidding_enabled (default false), so flipping that row brings
-- auctions back without a rebuild. This migration:
--   1. adds the flag row (same key/value table as landing_mode_enabled);
--   2. adds public.bidding_enabled(), the single DB-side reader of the flag;
--   3. gates direct bid and counter-offer INSERTs on it, so an old app bundle
--      cannot bid while the flag is off. buy_now() is unaffected: it is
--      SECURITY DEFINER and owned by the table owner, so its own bid insert
--      bypasses RLS (no table uses FORCE ROW LEVEL SECURITY);
--   4. re-applies the guarded sync_vehicle_eur_from_aed() from migration 015.
--      Commit e57586f edited 015 in place to derive *_eur only when the *_aed
--      value changed, but the edit was never applied, so production still ran
--      the first version and overwrote any admin-set EUR price on AED-priced
--      vehicles at the next update — including the price set when publishing.
--
-- Creates no table (grants rule: nothing to grant). Additive + idempotent.
-- =====================================================================

-- 1. The flag. Off by default: the product is a fixed-price marketplace.
insert into public.app_settings (key, value)
values ('bidding_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- 2. Single DB-side reader. Anything other than JSON true means "off".
create or replace function public.bidding_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value = 'true'::jsonb from public.app_settings where key = 'bidding_enabled'),
    false
  );
$$;

revoke all on function public.bidding_enabled() from public;
grant execute on function public.bidding_enabled() to anon, authenticated, service_role;

-- 3. Gate direct bids and counter-offers on the flag (KYC rule unchanged for
--    bids; counter-offers gain the same KYC check the web action already applies).
drop policy if exists "verified users can place bids" on public.bids;
create policy "verified users can place bids"
  on public.bids for insert
  with check (
    auth.uid() = bidder_id
    and public.is_kyc_verified(auth.uid())
    and public.bidding_enabled()
  );

drop policy if exists "bidders insert their counter offers" on public.counter_offers;
create policy "bidders insert their counter offers"
  on public.counter_offers for insert
  with check (
    auth.uid() = bidder_id
    and public.is_kyc_verified(auth.uid())
    and public.bidding_enabled()
  );

-- 4. Guarded EUR-from-AED derivation (the version committed in 015).
create or replace function public.sync_vehicle_eur_from_aed()
returns trigger language plpgsql as $$
declare rate constant numeric := 3.92;
begin
  if new.price_aed is not null
     and (tg_op = 'INSERT' or new.price_aed is distinct from old.price_aed) then
    new.listed_price_eur := round(new.price_aed / rate, 2);
  end if;
  if new.reserve_price_aed is not null
     and (tg_op = 'INSERT' or new.reserve_price_aed is distinct from old.reserve_price_aed) then
    new.reserve_price_eur := round(new.reserve_price_aed / rate, 2);
  end if;
  if new.buy_now_price_aed is not null
     and (tg_op = 'INSERT' or new.buy_now_price_aed is distinct from old.buy_now_price_aed) then
    new.buy_now_price_eur := round(new.buy_now_price_aed / rate, 2);
  end if;
  return new;
end $$;
