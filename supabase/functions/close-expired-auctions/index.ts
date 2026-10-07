// close-expired-auctions — the single scheduled sweep (pg_cron job, every 2
// minutes) that closes listings/auctions whose end_time has passed.
//
// Fixed-price marketplace (app_settings.bidding_enabled = false, the default):
// a listing is live for 7 calendar days from publish (end_time). When that
// passes unsold, the row is closed as 'ended' and the vehicle goes back to
// 'listed' — it leaves the marketplace and the admin can relist it (which
// restarts the 7 days). Sales never happen here: buy_now() closes a sold
// listing immediately, so the sweep only ever sees unsold ones.
//
// Bidding enabled (dormant mode): the original auction settlement — if there
// is a top bid AND (no reserve OR top >= reserve) → SOLD, winner + sold_at on
// the vehicle, "you won" notification + email (the invoice is created by the
// DB trigger on status='sold'); otherwise → ENDED and the vehicle relisted.
//
// Expiry is time-based, so no trigger can enforce it: the marketplace queries
// also compare end_time to the clock, so an expired listing disappears even in
// the up-to-2-minute gap before this sweep runs. Every write is guarded on
// status='active' so a concurrent buy_now() or a re-run can't be clobbered.
//
// Auth: protected by a shared secret (x-cron-secret header == CRON_SECRET env).
// Deploy:  supabase functions deploy close-expired-auctions --no-verify-jwt
// Secret:  supabase secrets set CRON_SECRET=<random>
// Schedule (SQL, pg_cron + pg_net) — every 2 minutes:
//   select cron.schedule('close-expired-auctions','*/2 * * * *', $$
//     select net.http_post(
//       url := 'https://<project>.functions.supabase.co/close-expired-auctions',
//       headers := jsonb_build_object('x-cron-secret','<random>'));
//   $$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const SITE = (Deno.env.get("SITE_URL") ?? "https://xportacar.com").replace(/\/$/, "");

  const { data: flag } = await admin
    .from("app_settings").select("value").eq("key", "bidding_enabled").maybeSingle();
  const biddingEnabled = (flag as { value?: unknown } | null)?.value === true;

  const nowIso = new Date().toISOString();
  const { data: expired, error } = await admin
    .from("auctions")
    .select("id, vehicle_id, reserve_price_eur, starting_price_eur")
    .eq("status", "active")
    .lt("end_time", nowIso);
  if (error) {
    console.error("close-expired-auctions: query failed", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sold = 0;
  let ended = 0;

  for (const a of expired ?? []) {
    if (biddingEnabled) {
      // Highest bid on this auction.
      const { data: top } = await admin
        .from("bids")
        .select("bidder_id, amount_eur")
        .eq("auction_id", a.id)
        .order("amount_eur", { ascending: false })
        .limit(1)
        .maybeSingle();

      const reserve = a.reserve_price_eur as number | null;
      const reserveMet = top != null && (reserve == null || Number(top.amount_eur) >= Number(reserve));

      if (top && reserveMet) {
        const { data: won } = await admin.from("auctions").update({
          status: "sold",
          winner_id: top.bidder_id,
          current_bid_eur: top.amount_eur,
          end_time: nowIso,
        }).eq("id", a.id).eq("status", "active").select("id");
        if (!won || won.length === 0) continue; // closed concurrently
        // Invoice is auto-created by trg_auctions_invoice on status='sold'.
        await admin.from("vehicles").update({ status: "sold", sold_at: nowIso }).eq("id", a.vehicle_id);
        await admin.from("notifications").insert({
          user_id: top.bidder_id,
          type: "auction_won",
          title: "You won the auction!",
          body: "Your winning bid was accepted. Review your invoice and complete payment.",
          data: { auction_id: a.id, vehicle_id: a.vehicle_id, amount_eur: top.amount_eur },
        });
        // Localized "you won" email via the web's internal notify route.
        try {
          const { data: winner } = await admin
            .from("profiles").select("email, full_name, language").eq("id", top.bidder_id).single();
          const w = winner as { email?: string; full_name?: string; language?: string } | null;
          if (w?.email) {
            await fetch(`${SITE}/api/internal/notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-cron-secret": secret },
              body: JSON.stringify({
                kind: "auction_won", to: w.email, name: w.full_name ?? "",
                auctionId: a.id, amountEur: Number(top.amount_eur), locale: w.language ?? undefined,
              }),
            });
          }
        } catch (e) {
          console.error("close-expired-auctions: won-email post failed", (e as Error)?.message);
        }
        sold++;
        continue;
      }
    }

    // Unsold (or fixed-price): close the row and put the vehicle back to
    // 'listed' so it leaves the marketplace and can be relisted. Only a
    // vehicle still in_auction is moved, never one an admin has re-routed.
    const { data: closed } = await admin
      .from("auctions").update({ status: "ended" })
      .eq("id", a.id).eq("status", "active").select("id");
    if (!closed || closed.length === 0) continue; // sold/closed concurrently
    await admin.from("vehicles").update({ status: "listed" }).eq("id", a.vehicle_id).eq("status", "in_auction");
    ended++;
  }

  console.log(`close-expired-auctions: bidding=${biddingEnabled} processed=${(expired ?? []).length} sold=${sold} ended=${ended}`);
  return new Response(JSON.stringify({ ok: true, biddingEnabled, processed: (expired ?? []).length, sold, ended }), {
    headers: { "Content-Type": "application/json" },
  });
});
