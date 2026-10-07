"use server";

// Server actions for the auction page — bidding, buy-now, proxy bidding,
// counter offers, and the outbid-notification fan-out that runs after a
// successful bid.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bidIncrement } from "@/lib/constants";
import { sendOutbidEmail, sendAuctionWonEmail, sendPurchaseConfirmedEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { getAppSettings } from "@/lib/settings";

export interface ActionResult {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/** Why a purchase failed, so the client can show a translated message. */
export type BuyErrorCode = "AUTH" | "KYC" | "UNAVAILABLE" | "GENERIC";

const BIDDING_OFF = "Bidding is not available on this marketplace.";

// KYC gate. Returns an error string when the signed-in buyer is not verified
// ('verified' is the approved state of the kyc_status enum). The DB enforces
// this too (bids INSERT RLS + buy_now() RPC, migration 024) — this gives a
// clean message instead of a raw RLS failure, and is the only TS-side guard
// the web bid path relies on.
async function kycGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles").select("kyc_status").eq("id", userId).single();
  const status = (profile as { kyc_status?: string } | null)?.kyc_status;
  if (status === "verified") return null;
  return status === "rejected"
    ? "Your verification was declined. Re-submit your documents from your profile to continue."
    : "Your account is pending verification. You can continue once an admin approves your documents.";
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

  // Dormant unless app_settings.bidding_enabled is on (the bids INSERT policy
  // enforces the same flag in the DB).
  if (!(await getAppSettings()).biddingEnabled) return { ok: false, error: BIDDING_OFF };

  const kycErr = await kycGate(supabase, user.id);
  if (kycErr) return { ok: false, error: kycErr };

  // Rate limit: at most one bid per second per user (anti-spam). Uses the
  // idx_bids_bidder (bidder_id, created_at desc) index, so it's a cheap lookup.
  const { data: lastBid } = await supabase
    .from("bids")
    .select("created_at")
    .eq("bidder_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastBid && Date.now() - new Date(lastBid.created_at as string).getTime() < 1000) {
    return { ok: false, error: "You're bidding too fast — wait a second and try again." };
  }

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
// Buy — the fixed-price purchase (also Buy Now on an auction)
//
// Runs the buy_now() RPC, the single purchase path shared with the buyer app:
// KYC gate, row lock on the listing, live/price checks, records the purchase as
// a bid at the fixed price, closes the listing as sold (trg_auctions_invoice
// creates the invoice) and marks the vehicle sold — all in one transaction, so
// two buyers can never both win the same car. (This action used to re-implement
// those steps with separate service-role writes and no lock.)
// --------------------------------------------------------------------
export async function buyNowAction(input: {
  auctionId: string;
}): Promise<ActionResult & { code?: BuyErrorCode }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "AUTH", error: "Sign in to buy this vehicle." };

  const kycErr = await kycGate(supabase, user.id);
  if (kycErr) return { ok: false, code: "KYC", error: kycErr };

  const { error: rpcErr } = await supabase.rpc("buy_now", { p_auction_id: input.auctionId });
  if (rpcErr) {
    const m = rpcErr.message ?? "";
    const code: BuyErrorCode =
      m.includes("KYC_REQUIRED") ? "KYC"
      : m.includes("AUTH_REQUIRED") ? "AUTH"
      : /AUCTION_NOT_FOUND|AUCTION_NOT_ACTIVE|AUCTION_ENDED|BUY_NOW_UNAVAILABLE/.test(m) ? "UNAVAILABLE"
      : "GENERIC";
    return { ok: false, code, error: m };
  }

  // Read the closed listing back (service role: buyers can't read every column
  // they need through RLS joins) for the invoice guard, notification and email.
  const admin = createAdminClient();
  const { data: auction } = await admin
    .from("auctions")
    .select("id, vehicle_id, current_bid_eur, buy_now_price_eur, vehicle:vehicles!vehicle_id ( year, make, model )")
    .eq("id", input.auctionId)
    .single();
  const a = auction as unknown as {
    id: string; vehicle_id: string; current_bid_eur: number | null; buy_now_price_eur: number | null;
    vehicle: { year: number; make: string; model: string } | null;
  } | null;
  if (!a) return { ok: true, data: { auctionId: input.auctionId } };
  const price = Number(a.current_bid_eur ?? a.buy_now_price_eur ?? 0);

  // trg_auctions_invoice creates the invoice inside buy_now(). Keep the old
  // belt-and-braces guard (idempotent on the unique auction_id).
  const { data: existingInvoice } = await admin
    .from("invoices").select("id").eq("auction_id", a.id).maybeSingle();
  if (!existingInvoice) {
    const fee = Math.round(price * 0.029 * 100) / 100;
    await admin.from("invoices").insert({
      auction_id: a.id,
      buyer_id:   user.id,
      vehicle_id: a.vehicle_id,
      amount_eur: price,
      platform_fee_eur: fee,
      total_eur: price + fee,
      status: "pending",
    });
  }

  const { biddingEnabled } = await getAppSettings();
  const vehicleTitle = a.vehicle ? `${a.vehicle.year} ${a.vehicle.make} ${a.vehicle.model}` : "";

  // Notifications are stored in canonical English (read across apps).
  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "auction_won",
    title: biddingEnabled ? "You won this auction!" : "Purchase confirmed",
    body: biddingEnabled
      ? `Your Buy-Now purchase has been recorded. Our team will be in touch about shipping.`
      : `${vehicleTitle ? `${vehicleTitle} is yours. ` : ""}Choose shipping and confirm your order to receive your invoice.`,
    data: { auction_id: a.id, vehicle_id: a.vehicle_id, amount_eur: price },
  });

  // Best-effort email, localized to the buyer's language.
  const { data: profile } = await supabase
    .from("profiles").select("email, full_name, language").eq("id", user.id).single();
  if (profile?.email) {
    const locale = (profile as { language?: string }).language;
    if (biddingEnabled) {
      await sendAuctionWonEmail({
        to: profile.email, name: profile.full_name ?? "", auctionId: a.id, amountEur: price, locale,
      });
    } else {
      await sendPurchaseConfirmedEmail({
        to: profile.email, vehicleTitle, amountEur: price, auctionId: a.id, locale,
      });
    }
  }

  revalidatePath(`/auction/${a.id}`);
  revalidatePath(`/vehicle/${a.vehicle_id}`);
  revalidatePath("/marketplace");
  revalidatePath("/dashboard");
  return { ok: true, data: { auctionId: a.id } };
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

  // Counter-offers sit behind the same flag as bidding (and the same DB gate).
  if (!(await getAppSettings()).biddingEnabled) return { ok: false, error: BIDDING_OFF };

  const kycErr = await kycGate(supabase, user.id);
  if (kycErr) return { ok: false, error: kycErr };

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
  // Service role: the outbid user is someone else, and since migration 033 a
  // session may only insert notifications addressed to itself. Best-effort.
  try {
    await createAdminClient().from("notifications").insert({
      user_id: outbidUserId,
      type:    "outbid",
      title, body,
      data:    { auction_id: auctionId, vehicle_id: vehicleId, amount_eur: newBidEur },
    });
  } catch { /* admin client not configured — skip the in-app notification */ }
  // Read the outbid user's contact via the service-role client: profiles SELECT
  // is restricted to self+staff (migration 027) and the bidder is neither.
  // Best-effort — skip the email if the admin client is unavailable.
  type OutbidContact = { email?: string | null; full_name?: string | null; language?: string | null };
  let profile: OutbidContact | null = null;
  try {
    const { data } = await createAdminClient()
      .from("profiles").select("email, full_name, language").eq("id", outbidUserId).single();
    profile = (data as unknown as OutbidContact | null) ?? null;
  } catch { /* admin client not configured — skip outbid email */ }
  if (profile?.email) {
    await sendOutbidEmail({ to: profile.email, name: profile.full_name ?? "", vehicleTitle: vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "your auction", newBidEur, auctionId, locale: (profile as { language?: string }).language });
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

  // KYC gate also applies to proxy auto-bids. These inserts use the service-role
  // client (bidding on someone else's behalf bypasses the bids RLS), so drop any
  // bidder who is no longer verified — e.g. an admin rejected them mid-auction.
  const bidderIds = [...maxByBidder.keys()];
  if (bidderIds.length > 0) {
    const { data: verifiedRows } = await admin
      .from("profiles").select("id").in("id", bidderIds).eq("kyc_status", "verified");
    const verified = new Set((verifiedRows ?? []).map((r) => (r as { id: string }).id));
    for (const id of bidderIds) if (!verified.has(id)) maxByBidder.delete(id);
    if (maxByBidder.size === 0) return;
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
