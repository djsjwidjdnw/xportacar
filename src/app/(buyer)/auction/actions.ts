"use server";

// Server actions for the auction page — bidding, buy-now, and the helper
// outbid-notification fan-out that runs after a successful bid.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bidIncrement } from "@/lib/constants";

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

// --------------------------------------------------------------------
// Place a bid
// --------------------------------------------------------------------
export async function placeBidAction(input: {
  auctionId: string;
  amountEur: number;
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
      auction_id: auction.id,
      bidder_id: user.id,
      amount_eur: input.amountEur,
    });

  if (insErr) return { ok: false, error: insErr.message };

  // Best-effort outbid notification — never block the user on it.
  if (prevTop && prevTop.bidder_id && prevTop.bidder_id !== user.id) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("year, make, model")
      .eq("id", auction.vehicle_id)
      .single();
    const title = "You have been outbid";
    const body = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model} — new top bid €${input.amountEur.toLocaleString("en-GB")}`
      : `New top bid €${input.amountEur.toLocaleString("en-GB")}`;
    await supabase.from("notifications").insert({
      user_id: prevTop.bidder_id,
      type: "outbid",
      title,
      body,
      data: { auction_id: auction.id, amount_eur: input.amountEur },
    });
  }

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
  if (auction.buy_now_price_eur == null) return { ok: false, error: "Buy Now is not available." };

  const price = auction.buy_now_price_eur as number;

  // Record the winning Buy-Now bid so bid history shows it.  This runs as
  // the user, so RLS lets it through.  The trigger bumps current_bid /
  // bid_count.
  const { error: bidErr } = await supabase
    .from("bids")
    .insert({ auction_id: auction.id, bidder_id: user.id, amount_eur: price });
  if (bidErr) return { ok: false, error: bidErr.message };

  // RLS on `auctions` only allows staff to UPDATE, so we use the service-
  // role admin client to close the auction.  The user has already been
  // authenticated above — we only do exactly the writes Buy-Now requires.
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

  revalidatePath(`/auction/${auction.id}`);
  revalidatePath("/dashboard");
  return { ok: true, data: { auctionId: auction.id } };
}
