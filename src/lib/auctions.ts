import "server-only";

// Auction settlement.
//
// There is no cron/trigger that closes an auction when its end_time passes,
// so a finished auction can sit at status='active' indefinitely.  These
// helpers settle such auctions lazily — whenever a page that cares about the
// outcome (watchlist, dashboard) is viewed, it asks us to settle the auctions
// it just read.  Everything is best-effort and idempotent: settlement only
// touches rows that are still 'active' with a past end_time, so re-running is
// a no-op.  Uses the service-role client because RLS only lets staff write
// auctions.

import { createAdminClient } from "@/lib/supabase/admin";

interface DueAuction {
  id: string;
  vehicle_id: string;
  current_bid_eur: number | null;
  reserve_price_eur: number | null;
}

/**
 * Settle the given auctions if their end_time has passed but status is still
 * 'active'.  Winner = highest bidder when the reserve (if any) is met.
 */
export async function settleEndedAuctions(auctionIds: string[]): Promise<void> {
  const ids = Array.from(new Set(auctionIds.filter(Boolean)));
  if (ids.length === 0) return;

  try {
    const admin = createAdminClient();
    const { data: due } = await admin
      .from("auctions")
      .select("id, vehicle_id, current_bid_eur, reserve_price_eur")
      .in("id", ids)
      .eq("status", "active")
      .lte("end_time", new Date().toISOString());

    for (const a of (due ?? []) as DueAuction[]) {
      const { data: top } = await admin
        .from("bids")
        .select("bidder_id, amount_eur")
        .eq("auction_id", a.id)
        .order("amount_eur", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const reserve = a.reserve_price_eur == null ? null : Number(a.reserve_price_eur);
      const finalBid =
        top?.amount_eur != null ? Number(top.amount_eur)
        : a.current_bid_eur != null ? Number(a.current_bid_eur)
        : null;
      const reserveMet = reserve == null || (finalBid != null && finalBid >= reserve);
      const winnerId = top?.bidder_id && reserveMet ? (top.bidder_id as string) : null;

      // The `.eq("status","active")` guard makes this safe against a double
      // settle from two concurrent page loads — only the first wins.
      const { error: updErr } = await admin
        .from("auctions")
        .update({
          status: winnerId ? "sold" : "ended",
          winner_id: winnerId,
          ...(finalBid != null ? { current_bid_eur: finalBid } : {}),
        })
        .eq("id", a.id)
        .eq("status", "active");
      if (updErr) continue;

      if (winnerId) {
        await admin.from("vehicles").update({ status: "sold" }).eq("id", a.vehicle_id);
        await admin.from("notifications").insert({
          user_id: winnerId,
          type: "auction_won",
          title: "You won this auction!",
          body: "Your winning bid has been recorded. View your invoice and payment details.",
          data: { auction_id: a.id, amount_eur: finalBid },
        });
      }
    }
  } catch {
    // Best-effort — settlement must never break the page that triggered it.
  }
}

/**
 * Remove the given vehicles from a user's watchlist.  Used to drop vehicles
 * whose auction has ended (won items live on in the dashboard's Won Auctions;
 * lost / un-bid items simply disappear).  Scoped to the user + vehicle ids.
 */
export async function pruneWatchlistVehicles(userId: string, vehicleIds: string[]): Promise<void> {
  const ids = Array.from(new Set(vehicleIds.filter(Boolean)));
  if (!userId || ids.length === 0) return;
  try {
    const admin = createAdminClient();
    await admin
      .from("watchlist")
      .delete()
      .eq("user_id", userId)
      .in("vehicle_id", ids);
  } catch {
    // Best-effort.
  }
}
