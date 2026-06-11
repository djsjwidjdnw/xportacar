// close-expired-auctions — scheduled job (Supabase cron) that closes auctions
// whose timer has expired. For each expired ACTIVE auction:
//   • if there is a top bid AND (no reserve OR top >= reserve) → mark it SOLD,
//     set winner + sold_at on the vehicle, and drop a "you won" notification
//     (the invoice is created by the existing DB trigger on status='sold').
//   • otherwise → mark the auction ENDED and return the vehicle to 'listed'.
//
// Bidding after expiry is already blocked at the app layer (placeBidAction
// checks end_time); this just finalises state so winners + invoices exist and
// the marketplace stops showing it as live.
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
      await admin.from("auctions").update({
        status: "sold",
        winner_id: top.bidder_id,
        current_bid_eur: top.amount_eur,
        end_time: nowIso,
      }).eq("id", a.id);
      // Invoice is auto-created by trg_auctions_invoice on status='sold'.
      await admin.from("vehicles").update({ status: "sold", sold_at: nowIso }).eq("id", a.vehicle_id);
      await admin.from("notifications").insert({
        user_id: top.bidder_id,
        type: "auction_won",
        title: "You won the auction!",
        body: "Your winning bid was accepted. Review your invoice and complete payment.",
        data: { auction_id: a.id, vehicle_id: a.vehicle_id, amount_eur: top.amount_eur },
      });
      sold++;
    } else {
      // No bids or reserve not met → close without a sale; relist the vehicle.
      await admin.from("auctions").update({ status: "ended", end_time: nowIso }).eq("id", a.id);
      await admin.from("vehicles").update({ status: "listed" }).eq("id", a.vehicle_id);
      ended++;
    }
  }

  console.log(`close-expired-auctions: processed=${(expired ?? []).length} sold=${sold} ended=${ended}`);
  return new Response(JSON.stringify({ ok: true, processed: (expired ?? []).length, sold, ended }), {
    headers: { "Content-Type": "application/json" },
  });
});
