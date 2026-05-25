"use server";

// Server actions for the auction page — bidding, buy-now, proxy bidding,
// counter offers, and the outbid-notification fan-out that runs after a
// successful bid.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bidIncrement } from "@/lib/constants";
import { sendOutbidEmail, sendAuctionWonEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

// --------------------------------------------------------------------
// Place a bid (with optional proxy maximum)
//
// `proxyMaxEur` enables proxy/maximum bidding — the user's bid sits at
// `amountEur`, but if another bidder beats them the system will auto-
// reply up to `proxyMaxEur` in standard ladder increments.  See the
// `cascadeProxies` helper at the bottom of the file.
// --------------------------------------------------------------------
export async function placeBidAction(input: {
  auctionId: string;
  amountEur: number;
  proxyMaxEur?: number | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to place a bid." };

  // Load the auction to validate.
  const { data: auction, error: aErr } = await supabase
    .from("auctions")
    .select("id, status, end_time, starting_price_eur, current_bid_eur, vehicle_id")
    .eq("id", input.auctionId)
    .single();

  if (aErr || !auction) return { ok: false, error: "Auction not found." };
  if (auction.status !== "active") return { ok: false, error: "Auction is not live." };
  if (new Date(auction.end_time).getTime() <= Date.now()) {
    return { ok: false, error: "Auction has ended." };
  }

  const currentBid = (auction.current_bid_eur as number | null) ?? (auction.starting_price_eur as number);
  const minNext = currentBid + bidIncrement(currentBid);
  if (!Number.isFinite(input.amountEur) || input.amountEur < minNext) {
    return { ok: false, error: `Minimum next bid is €${minNext.toLocaleString("en-GB")}.` };
  }
  if (input.proxyMaxEur != null && input.proxyMaxEur < input.amountEur) {
    return { ok: false, error: "Proxy maximum must be at least your bid amount." };
  }

  // Capture the current top bidder (so we can notify them they were outbid).
  const { data: prevTop } = await supabase
    .from("bids")
    .select("bidder_id, amount_eur")
    .eq("auction_id", auction.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Insert — the DB trigger updates auctions.current_bid / bid_count / bidder_count.
  const { error: insErr } = await supabase
    .from("bids")
    .insert({
      auction_id:    auction.id,
      bidder_id:     user.id,
      amount_eur:    input.amountEur,
      is_proxy:      input.proxyMaxEur != null,
      proxy_max_eur: input.proxyMaxEur ?? null,
    });

  if (insErr) return { ok: false, error: insErr.message };

  // Outbid notification (best-effort, never blocks the user).
  if (prevTop && prevTop.bidder_id && prevTop.bidder_id !== user.id) {
    await notifyOutbid(prevTop.bidder_id, auction.vehicle_id, auction.id, input.amountEur);
  }

  // Cascade existing proxy bids — see helper below.
  await cascadeProxies(auction.id, user.id, input.amountEur);

  revalidatePath(`/auction/${auction.id}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { minNext } };
}

// --------------------------------------------------------------------
// Buy Now — close the auction, set winner, mark vehicle sold
// --------------------------------------------------------------------
export async function buyNowAction(input: {
  auctionId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to buy this vehicle." };

  const { data: auction, error: aErr } = await supabase
    .from("auctions")
    .select("id, status, end_time, vehicle_id, buy_now_price_eur, current_bid_eur, starting_price_eur")
    .eq("id", input.auctionId)
    .single();

  if (aErr || !auction) return { ok: false, error: "Auction not found." };
  if (auction.status !== "active") return { ok: false, error: "Auction is not live." };
  if (new Date(auction.end_time).getTime() <= Date.now()) {
    return { ok: false, error: "Auction has ended." };
  }
  if (auction.buy_now_price_eur == null) return { ok: false, error: "Buy Now is not available." };

  const price = auction.buy_now_price_eur as number;

  const { error: bidErr } = await supabase
    .from("bids")
    .insert({ auction_id: auction.id, bidder_id: user.id, amount_eur: price });
  if (bidErr) return { ok: false, error: bidErr.message };

  // RLS on `auctions` only allows staff to UPDATE, so we use the service-
  // role admin client to close the auction.  Same for the vehicle.
  const admin = createAdminClient();
  await admin
    .from("auctions")
    .update({
      status: "sold",
      winner_id: user.id,
      end_time: new Date().toISOString(),
      current_bid_eur: price,
    })
    .eq("id", auction.id);

  await admin
    .from("vehicles")
    .update({ status: "sold" })
    .eq("id", auction.vehicle_id);

  // "You won" notification.
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "auction_won",
    title: "You won this auction!",
    body: `Your Buy-Now purchase has been recorded. Our team will be in touch about shipping.`,
    data: { auction_id: auction.id, amount_eur: price },
  });

  // Best-effort welcome email.
  const { data: profile } = await supabase
    .from("profiles").select("email, full_name").eq("id", user.id).single();
  if (profile?.email) {
    await sendAuctionWonEmail({ to: profile.email, name: profile.full_name ?? "", auctionId: auction.id, amountEur: price });
  }

  revalidatePath(`/auction/${auction.id}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { auctionId: auction.id } };
}

// --------------------------------------------------------------------
// Counter offer
// --------------------------------------------------------------------
export async function placeCounterOfferAction(input: {
  auctionId: string;
  amountEur: number;
  message?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to make a counter offer." };

  if (!Number.isFinite(input.amountEur) || input.amountEur <= 0) {
    return { ok: false, error: "Enter a valid offer amount." };
  }

  const { error } = await supabase
    .from("counter_offers")
    .insert({
      auction_id: input.auctionId,
      bidder_id:  user.id,
      amount_eur: input.amountEur,
      message:    input.message ?? null,
      expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/auction/${input.auctionId}`);
  revalidatePath("/admin/counter-offers");
  return { ok: true };
}

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

async function notifyOutbid(
  outbidUserId: string,
  vehicleId: string,
  auctionId: string,
  newBidEur: number,
) {
  const supabase = await createClient();
  const { data: vehicle } = await supabase
    .from("vehicles").select("year, make, model").eq("id", vehicleId).single();
  const title = "You have been outbid";
  const body = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model} — new top bid €${newBidEur.toLocaleString("en-GB")}`
    : `New top bid €${newBidEur.toLocaleString("en-GB")}`;
  await supabase.from("notifications").insert({
    user_id: outbidUserId,
    type:    "outbid",
    title, body,
    data:    { auction_id: auctionId, vehicle_id: vehicleId, amount_eur: newBidEur },
  });
  const { data: profile } = await supabase
    .from("profiles").select("email, full_name").eq("id", outbidUserId).single();
  if (profile?.email) {
    await sendOutbidEmail({ to: profile.email, name: profile.full_name ?? "", vehicleTitle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "your auction", newBidEur, auctionId });
  }
  // Push notification — silently skips when no tokens are registered.
  await sendPushToUser({
    userId: outbidUserId,
    title, body,
    data:   { auction_id: auctionId, vehicle_id: vehicleId },
  });
}

/**
 * After a new bid comes in, walk the active proxy-max bids on the same
 * auction (other than the bidder who just placed it) and let them auto-
 * respond up to their proxy_max_eur.  Repeats until either:
 *   - the latest top bid is owned by a proxy bidder whose max isn't beaten,
 *   - or no proxy bid has a max greater than the current top.
 *
 * Uses the admin client because the proxy bid is "submitted on behalf of"
 * another user and must bypass `auth.uid() = bidder_id` check.
 */
async function cascadeProxies(auctionId: string, lastBidderId: string, lastAmount: number) {
  const admin = createAdminClient();

  // Pull the highest active proxy per bidder for this auction.
  const { data: proxies } = await admin
    .from("bids")
    .select("bidder_id, proxy_max_eur")
    .eq("auction_id", auctionId)
    .eq("is_proxy", true)
    .not("proxy_max_eur", "is", null);

  if (!proxies || proxies.length === 0) return;

  // Reduce to one entry per bidder: max proxy_max_eur.
  const maxByBidder = new Map<string, number>();
  for (const p of proxies as { bidder_id: string; proxy_max_eur: number }[]) {
    const cur = maxByBidder.get(p.bidder_id) ?? 0;
    if (p.proxy_max_eur > cur) maxByBidder.set(p.bidder_id, p.proxy_max_eur);
  }

  let topAmount = lastAmount;
  let topBidder = lastBidderId;
  const STEP = 500;
  const HARD_STOP = 50; // safety: never loop more than 50 cascade rounds

  for (let i = 0; i < HARD_STOP; i++) {
    // Find a candidate proxy bidder who is NOT the current top and whose
    // max exceeds the next required step.
    let challenger: { id: string; max: number } | null = null;
    for (const [bidderId, max] of maxByBidder) {
      if (bidderId === topBidder) continue;
      if (max <= topAmount) continue;
      if (!challenger || max > challenger.max) challenger = { id: bidderId, max };
    }
    if (!challenger) break;

    // The challenger raises by one bid step OR to their max, whichever is lower.
    const next = Math.min(topAmount + STEP, challenger.max);
    const { error } = await admin.from("bids").insert({
      auction_id: auctionId,
      bidder_id:  challenger.id,
      amount_eur: next,
      is_proxy:   true,
      proxy_max_eur: challenger.max,
    });
    if (error) break;

    // Notify whoever was just outbid.
    await notifyOutbid(topBidder, await vehicleIdForAuction(auctionId), auctionId, next);

    topAmount = next;
    topBidder = challenger.id;

    // If the challenger has now exhausted their max, drop them out so we
    // don't keep nominating them on the next iteration.
    if (next >= challenger.max) maxByBidder.delete(challenger.id);
  }
}

async function vehicleIdForAuction(auctionId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("auctions").select("vehicle_id").eq("id", auctionId).single();
  return (data as { vehicle_id: string } | null)?.vehicle_id ?? "";
}
