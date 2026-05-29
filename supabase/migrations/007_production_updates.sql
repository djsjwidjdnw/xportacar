-- Production readiness: 2.9% platform fee, two-step payment confirmation,
-- and refreshed shipping rates.

-- 1) Payment confirmation (Step 1 of the win flow: confirm within 36h).
alter table public.invoices
  add column if not exists payment_confirmed_at timestamptz;

-- Buyer-callable RPC so the mobile app (anon key) can confirm without an
-- invoices UPDATE policy. SECURITY DEFINER; scoped to the caller's own invoice.
create or replace function public.confirm_invoice_payment(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.invoices
     set payment_confirmed_at = now()
   where id = p_invoice_id
     and buyer_id = auth.uid()
     and payment_confirmed_at is null;
end $$;
grant execute on function public.confirm_invoice_payment(uuid) to authenticated;

-- 2) Platform fee 5% -> 2.9% (source of truth for invoices.platform_fee_eur).
create or replace function public.create_invoice_for_sold_auction()
returns trigger language plpgsql as $$
declare
  v_amount   numeric(12,2);
  v_fee      numeric(12,2);
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') and new.winner_id is not null then
    v_amount := coalesce(new.current_bid_eur, new.starting_price_eur);
    v_fee    := round(v_amount * 0.029, 2);
    insert into public.invoices (auction_id, buyer_id, vehicle_id, amount_eur, platform_fee_eur, total_eur, status)
    values (new.id, new.winner_id, new.vehicle_id, v_amount, v_fee, v_amount + v_fee, 'pending')
    on conflict (auction_id) do nothing;
  end if;
  return new;
end $$;

-- Configurable default (admin settings) 5 -> 2.9.
update public.platform_settings set fee_percentage = 2.90 where fee_percentage = 5.00;
alter table public.platform_settings alter column fee_percentage set default 2.90;

-- 3) Refreshed shipping rates (current estimates — verify against carrier quotes).
update public.shipping_rates set base_price_eur = 1450, last_verified = current_date where route_key = 'roro_hamburg';
update public.shipping_rates set base_price_eur = 1350, last_verified = current_date where route_key = 'roro_rotterdam';
update public.shipping_rates set base_price_eur = 1450, last_verified = current_date where route_key = 'roro_bremerhaven';
update public.shipping_rates set base_price_eur = 1400, last_verified = current_date where route_key = 'roro_antwerp';
update public.shipping_rates set base_price_eur = 1550, last_verified = current_date where route_key = 'roro_genoa';
update public.shipping_rates set base_price_eur = 1650, last_verified = current_date where route_key = 'roro_barcelona';
update public.shipping_rates set base_price_eur = 2100, last_verified = current_date where route_key = 'container_hamburg';
update public.shipping_rates set base_price_eur = 1950, last_verified = current_date where route_key = 'container_rotterdam';
update public.shipping_rates set base_price_eur = 2100, last_verified = current_date where route_key = 'container_bremerhaven';
update public.shipping_rates set base_price_eur = 2300, last_verified = current_date where route_key = 'container_genoa';
update public.shipping_rates set base_price_eur = 0,    last_verified = current_date where route_key = 'warehouse_dubai';
update public.shipping_rates set base_price_eur = 950,  last_verified = current_date where route_key = 'door_to_door_eu';
update public.shipping_rates set base_price_eur = 750,  last_verified = current_date where route_key = 'service_tuv';
update public.shipping_rates set base_price_eur = 150,  rate_pct = 1.5, last_verified = current_date where route_key = 'service_marine_insurance';
update public.shipping_rates set base_price_eur = 250,  last_verified = current_date where route_key = 'service_customs_export_uae';
update public.shipping_rates set base_price_eur = 400,  last_verified = current_date where route_key = 'service_customs_import_eu';
