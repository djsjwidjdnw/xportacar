-- =====================================================================
-- 032 — Invoice money hole: buyers can no longer UPDATE invoices.
--
-- The hole: policy "buyers update own invoices" (USING auth.uid() = buyer_id,
-- no column limit) let a buyer PATCH their own invoice straight through
-- PostgREST — status, paid_at, amount_eur, total_eur, anything. The only code
-- that relied on it is finalizeInvoiceAndEmail() (src/lib/invoice/finalize.ts),
-- reached from the web order page (finalizeInvoiceShippingAction) and the
-- mobile endpoint POST /api/invoice/[id]/finalize. Every other invoice write
-- already runs as the service role (web actions, Stripe webhook, admin
-- verify) or inside a SECURITY DEFINER function (buy_now via the auctions
-- trigger, submit_payment_proof, confirm_invoice_payment, delete_my_account).
--
-- This migration:
--   1. adds public.finalize_my_invoice(): the buyer's legitimate writes —
--      shipping method, delivery address, extras, confirming the order — on
--      the CALLER'S OWN PENDING invoice only. Every euro amount is recomputed
--      here: a port of serverShippingEur() + serverPriceExtras()
--      (src/lib/distance.ts) and the 2.9% fee from finalize.ts. The function
--      takes no amount at all; extras are matched by name and re-priced.
--   2. drops "buyers update own invoices";
--   3. narrows "staff update invoices" (is_staff = admin, superadmin AND
--      inspector) to admins, so only an admin — or server code holding the
--      service role — can mark an invoice paid or change its status.
--
-- Creates no table (grants rule: nothing to grant). Idempotent.
-- =====================================================================

-- 1. The buyer's single write path.
create or replace function public.finalize_my_invoice(
  p_invoice_id      uuid,
  p_shipping_method text,
  p_line1           text             default null,
  p_line2           text             default null,
  p_city            text             default null,
  p_postal_code     text             default null,
  p_country         text             default null,           -- ISO 3166-1 alpha-2
  p_latitude        double precision default null,
  p_longitude       double precision default null,
  p_extras          jsonb            default '[]'::jsonb     -- [{ "name": ... }]; any price is ignored
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Pricing mirrors src/lib/distance.ts (PORT_FLAT_EUR, DOOR_PER_KM_EUR,
  -- OTHER_DEFAULT_KM, HAMBURG_PORT, DISTANCE_KM, ISO2_TO_NAME, TUV_EUR) and the
  -- 2.9% fee in src/lib/invoice/finalize.ts. Change both sides together.
  c_port_flat_eur constant numeric          := 4500;
  c_door_per_km   constant numeric          := 3.5;
  c_other_km      constant integer          := 800;
  c_hamburg_lat   constant double precision := 53.5375;
  c_hamburg_lon   constant double precision := 9.9778;
  c_tuv_name      constant text             := 'German Registration (TÜV)';
  c_tuv_eur       constant numeric          := 3570;
  c_fee_pct       constant numeric          := 0.029;
  c_km_table      constant jsonb := '{
    "germany":     {"_default": 400, "cities": {"berlin": 290, "munich": 770, "hamburg": 0, "frankfurt": 490,
                    "cologne": 430, "stuttgart": 670, "düsseldorf": 410, "dusseldorf": 410, "hannover": 150,
                    "hanover": 150, "leipzig": 380, "dresden": 470}},
    "netherlands": {"_default": 460, "cities": {"amsterdam": 460, "rotterdam": 460, "the hague": 480, "den haag": 480}},
    "belgium":     {"_default": 580, "cities": {"brussels": 600, "antwerp": 560, "antwerpen": 560}},
    "austria":     {"_default": 880, "cities": {"vienna": 900, "wien": 900, "salzburg": 850, "innsbruck": 870}},
    "france":      {"_default": 850, "cities": {"paris": 800, "lyon": 1100, "strasbourg": 700}},
    "switzerland": {"_default": 950, "cities": {"zurich": 850, "zürich": 850, "geneva": 1050, "genève": 1050}},
    "czechia":     {"_default": 600, "cities": {"prague": 600, "praha": 600}},
    "poland":      {"_default": 780, "cities": {"warsaw": 720, "warszawa": 720, "krakow": 850, "kraków": 850}}
  }';
  v_uid     uuid := auth.uid();
  v_inv     public.invoices%rowtype;
  v_method  text := case when p_shipping_method = 'door_to_door' then 'door_to_door' else 'standard' end;
  v_line1   text := nullif(btrim(p_line1), '');
  v_line2   text := nullif(btrim(p_line2), '');
  v_city    text := nullif(btrim(p_city), '');
  v_postal  text := nullif(btrim(p_postal_code), '');
  v_country text := nullif(upper(btrim(p_country)), '');
  v_lat     double precision;
  v_lon     double precision;
  v_s1      double precision;
  v_s2      double precision;
  v_x       double precision;
  v_entry   jsonb;
  v_ci      text;
  v_km      integer;
  v_ship    numeric;
  v_extras  jsonb   := '[]'::jsonb;
  v_ext_eur numeric := 0;
  v_fee     numeric;
  v_total   numeric;
  v_address text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Only the caller's own invoice, and only while it is still pending.
  select * into v_inv
    from public.invoices
   where id = p_invoice_id and buyer_id = v_uid
     for update;
  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'INVOICE_NOT_PENDING' using errcode = 'P0001';
  end if;

  -- Geocoded coordinates count only when both are present and on the globe.
  if p_latitude between -90 and 90 and p_longitude between -180 and 180 then
    v_lat := p_latitude;
    v_lon := p_longitude;
  end if;

  -- serverShippingEur(): standard = flat; door-to-door = flat + €3.50/km from
  -- Hamburg port — Haversine × 1.3 on coordinates, else the country/city table.
  if v_method = 'door_to_door' then
    if v_lat is not null then
      v_s1 := sin((((v_lat - c_hamburg_lat) * pi()) / 180) / 2);
      v_s2 := sin((((v_lon - c_hamburg_lon) * pi()) / 180) / 2);
      v_x  := 2 * 6371 * asin(least(1, sqrt(
                v_s1 * v_s1 + cos((c_hamburg_lat * pi()) / 180) * cos((v_lat * pi()) / 180) * (v_s2 * v_s2)
              ))) * 1.3::double precision;
      -- Math.round(): nearest integer, ties up — kept in double precision as JS does.
      v_km := greatest(0, (floor(v_x) + case when v_x - floor(v_x) >= 0.5 then 1 else 0 end)::integer);
    else
      v_entry := c_km_table -> (case v_country
                   when 'DE' then 'germany'  when 'NL' then 'netherlands' when 'BE' then 'belgium'
                   when 'AT' then 'austria'  when 'FR' then 'france'      when 'CH' then 'switzerland'
                   when 'CZ' then 'czechia'  when 'PL' then 'poland'      else '' end);
      v_ci := lower(coalesce(v_city, ''));
      v_km := case
                when v_entry is null then c_other_km
                when v_ci <> '' and (v_entry -> 'cities') ? v_ci then (v_entry -> 'cities' ->> v_ci)::integer
                else (v_entry ->> '_default')::integer
              end;
    end if;
    v_ship := c_port_flat_eur + round(v_km * c_door_per_km);
  else
    v_km   := null;
    v_ship := c_port_flat_eur;
  end if;

  -- serverPriceExtras(): names only; the price always comes from here.
  if jsonb_typeof(p_extras) = 'array' and exists (
       select 1
         from jsonb_array_elements(p_extras) e
        where jsonb_typeof(e) = 'object'
          and coalesce(e ->> 'name', '') ~* 't[üÜu]v|german registration'
     ) then
    v_extras  := jsonb_build_array(jsonb_build_object('name', c_tuv_name, 'price_eur', c_tuv_eur));
    v_ext_eur := c_tuv_eur;
  end if;

  v_fee     := round(v_inv.amount_eur * c_fee_pct, 2);
  v_total   := round(v_inv.amount_eur + v_fee + v_ship + v_ext_eur, 2);
  v_address := nullif(concat_ws(E'\n', v_line1, v_line2, nullif(concat_ws(' ', v_postal, v_city), ''), v_country), '');

  update public.invoices
     set shipping_method      = v_method,
         shipping_eur         = v_ship,
         shipping_distance_km = v_km,
         shipping_address     = v_address,
         shipping_line1       = v_line1,
         shipping_line2       = v_line2,
         shipping_city        = v_city,
         shipping_postal_code = v_postal,
         shipping_country     = v_country,
         shipping_latitude    = v_lat,
         shipping_longitude   = v_lon,
         extras               = v_extras,
         extras_eur           = v_ext_eur,
         platform_fee_eur     = v_fee,
         total_eur            = v_total
   where id = v_inv.id;

  return jsonb_build_object(
    'invoice_id',           v_inv.id,
    'invoice_number',       v_inv.invoice_number,
    'shipping_method',      v_method,
    'shipping_eur',         v_ship,
    'shipping_distance_km', v_km,
    'shipping_address',     v_address,
    'extras',               v_extras,
    'extras_eur',           v_ext_eur,
    'amount_eur',           v_inv.amount_eur,
    'platform_fee_eur',     v_fee,
    'total_eur',            v_total
  );
end
$$;

revoke all on function public.finalize_my_invoice(uuid, text, text, text, text, text, text, double precision, double precision, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_my_invoice(uuid, text, text, text, text, text, text, double precision, double precision, jsonb)
  to authenticated;

-- 2. No direct buyer UPDATE on invoices at all.
drop policy if exists "buyers update own invoices" on public.invoices;

-- 3. Only admins may update invoices directly (status, paid, amounts).
drop policy if exists "staff update invoices" on public.invoices;
drop policy if exists "admins update invoices" on public.invoices;
create policy "admins update invoices"
  on public.invoices for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Expose the new RPC to PostgREST straight away.
notify pgrst, 'reload schema';
