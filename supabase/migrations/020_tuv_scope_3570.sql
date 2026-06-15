-- 020 — German Registration (TÜV) add-on: price €3500 → €3570 + scope update.
--
-- The LIVE price for this add-on is the shipping_rates row (route_key
-- 'service_tuv'); the 3570 fallbacks in the TS code only apply when this row is
-- absent. So this UPDATE is what actually changes the price on the running site.
--
-- Scope change: drop the old "CoC / customs paperwork" wording; the add-on now
-- covers the German Paragraph 21 (§21) inspection, euro-spec conversion, and
-- obtaining the German vehicular registration documents.
--
-- Idempotent — a single UPDATE; safe to re-run.

update public.shipping_rates
set base_price_eur = 3570,
    notes = 'German Registration (TÜV): Paragraph 21 inspection, euro-spec conversion, German registration documents',
    last_verified = current_date
where route_key = 'service_tuv';
