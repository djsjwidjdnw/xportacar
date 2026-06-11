// notify-auctions-ending-soon — cron Edge Function (hourly). Finds active
// auctions ending in the next 24-25h window and emails everyone who has the
// vehicle in their watchlist OR has bid on it; bidders who are NOT the current
// top bidder are told they've been outbid. Deduped to 1 email per user per
// auction via automated_email_log (kind 'auction_ending'), so the hourly
// overlap never double-sends. Branded/localized send is delegated to the web
// app's /api/internal/notify route.
//
// Deploy:  supabase functions deploy notify-auctions-ending-soon --no-verify-jwt
// Secrets: supabase secrets set CRON_SECRET=<secret>  SITE_URL=https://xportacar.com
// Schedule: see the pg_cron SQL in the batch notes (hourly).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "unauthorized" }, 401);
  }
  const SITE = (Deno.env.get("SITE_URL") ?? "https://xportacar.com").replace(/\/$/, "");
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const now = Date.now();
  const windowStart = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();

  const { data: auctions, error } = await admin
    .from("auctions")
    .select("id, vehicle_id, current_bid_eur, starting_price_eur, vehicles:vehicles!vehicle_id ( year, make, model )")
    .eq("status", "active")
    .gte("end_time", windowStart)
    .lt("end_time", windowEnd);
  if (error) return json({ error: error.message }, 500);
  if (!auctions || auctions.length === 0) return json({ ok: true, auctions: 0, sent: 0 });

  let sent = 0;

  for (const a of auctions as AuctionRow[]) {
    const veh = Array.isArray(a.vehicles) ? a.vehicles[0] : a.vehicles;
    const title = veh ? `${veh.year} ${veh.make} ${veh.model}` : "Your vehicle";
    const price = a.current_bid_eur ?? a.starting_price_eur ?? null;

    // Current top bidder (so we can flag the rest as outbid).
    const { data: top } = await admin
      .from("bids").select("bidder_id").eq("auction_id", a.id)
      .order("amount_eur", { ascending: false }).limit(1).maybeSingle();
    const topBidder = top?.bidder_id ?? null;

    // Recipients: watchers + bidders (union).
    const { data: watchers } = await admin.from("watchlist").select("user_id").eq("vehicle_id", a.vehicle_id);
    const { data: bidders } = await admin.from("bids").select("bidder_id").eq("auction_id", a.id);
    const userIds = new Set<string>();
    for (const w of watchers ?? []) userIds.add((w as { user_id: string }).user_id);
    for (const b of bidders ?? []) userIds.add((b as { bidder_id: string }).bidder_id);
    if (userIds.size === 0) continue;

    const { data: profs } = await admin
      .from("profiles").select("id, email, language").in("id", [...userIds]);

    for (const p of (profs ?? []) as ProfileRow[]) {
      if (!p.email) continue;

      // Dedup: 1 ending-soon email per user per auction.
      const { error: dupErr } = await admin
        .from("automated_email_log")
        .insert({ user_id: p.id, kind: "auction_ending", ref_id: a.id });
      if (dupErr) continue; // unique (user, kind, ref) violation → already sent

      const isBidder = (bidders ?? []).some((b) => (b as { bidder_id: string }).bidder_id === p.id);
      const outbid = isBidder && topBidder != null && topBidder !== p.id;

      const ok = await postEmail(SITE, secret, {
        kind: "auction_ending", to: p.email, locale: p.language ?? undefined,
        vehicleTitle: title, auctionId: a.id, currentBidEur: price ?? undefined, outbid,
      });
      if (ok) sent++;
    }
  }

  console.log(`notify-auctions-ending-soon: auctions=${auctions.length} sent=${sent}`);
  return json({ ok: true, auctions: auctions.length, sent });
});

interface AuctionRow {
  id: string; vehicle_id: string; current_bid_eur: number | null; starting_price_eur: number | null;
  vehicles: { year: number; make: string; model: string } | { year: number; make: string; model: string }[] | null;
}
interface ProfileRow { id: string; email: string | null; language: string | null }

async function postEmail(site: string, secret: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${site}/api/internal/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": secret },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.error("notify-auctions-ending-soon: post failed", (e as Error)?.message);
    return false;
  }
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
}
