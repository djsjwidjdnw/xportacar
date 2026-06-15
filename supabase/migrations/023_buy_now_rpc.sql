-- 023 — buy_now() RPC for atomic Buy Now from clients without service-role.
--
-- The web app finalizes Buy Now in a server action using the service-role key
-- (close auction → set winner → mark vehicle sold → trigger creates invoice).
-- The mobile app has no server and the buyer's RLS role cannot UPDATE auctions
-- or vehicles, so a Buy Now from mobile previously only inserted a bid and the
-- sale was never finalized. This SECURITY DEFINER function performs the same
-- atomic finalization with its own authorization checks: the caller must be
-- authenticated and the winner is always auth.uid() (never a parameter), so it
-- cannot be used to buy on someone else's behalf.

create or replace function public.buy_now(p_auction_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_auction public.auctions%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Lock the auction row to serialize concurrent Buy Now / bids.
  select * into v_auction from public.auctions where id = p_auction_id for update;
  if not found then
    raise exception 'AUCTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_auction.status <> 'active' then
    raise exception 'AUCTION_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if v_auction.end_time <= now() then
    raise exception 'AUCTION_ENDED' using errcode = 'P0001';
  end if;
  if v_auction.buy_now_price_eur is null then
    raise exception 'BUY_NOW_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Record the winning Buy-Now bid.
  insert into public.bids (auction_id, bidder_id, amount_eur)
  values (p_auction_id, v_uid, v_auction.buy_now_price_eur);

  -- Close the auction → trg_auctions_invoice auto-creates the invoice.
  update public.auctions
     set status          = 'sold',
         winner_id       = v_uid,
         end_time        = now(),
         current_bid_eur = v_auction.buy_now_price_eur
   where id = p_auction_id;

  -- Mark the vehicle sold (mirrors the web server action).
  update public.vehicles
     set status = 'sold', sold_at = now()
   where id = v_auction.vehicle_id;

  return p_auction_id;
end;
$$;

-- Only signed-in users may call it; the function itself runs as definer.
revoke all on function public.buy_now(uuid) from public;
grant execute on function public.buy_now(uuid) to authenticated;
