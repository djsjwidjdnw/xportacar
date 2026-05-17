import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = "https://klettmjnnttajdyajafn.supabase.co";
const ANON_KEY = "sb_publishable_rawIwWZv12q9_VxVuaMOWQ_A2oXTEJ_";
const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

// 1) Raw count of auctions by status
const { data: byStatus, error: e1 } = await sb
  .from("auctions").select("status, end_time, current_bid_eur");
if (e1) { console.error("Auctions query error:", e1.message); process.exit(1); }
const counts = {};
for (const r of byStatus ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log("Auctions by status:", counts);
console.log("Total auctions rows:", (byStatus ?? []).length);
const active = (byStatus ?? []).filter(r => r.status === "active");
console.log("Active auctions:", active.length);
if (active.length > 0) {
  const now = Date.now();
  const future = active.filter(r => new Date(r.end_time).getTime() > now).length;
  const past = active.length - future;
  console.log("  → ending in future:", future);
  console.log("  → already past end_time:", past);
  console.log("  → sample end_times:", active.slice(0,3).map(r => r.end_time));
}

// 2) Replicate the LiveAuctionsScreen query EXACTLY
console.log("\n--- Replicating LiveAuctionsScreen query ---");
const { data: live, error: e2 } = await sb
  .from("vehicles")
  .select(`
    *,
    vehicle_photos (url, sort_order),
    auctions!inner (id, vehicle_id, status, start_time, end_time, starting_price_eur, current_bid_eur, buy_now_price_eur, reserve_price_eur, bid_count, bidder_count, winner_id)
  `)
  .eq("auctions.status", "active");
if (e2) { console.error("Live query error:", e2.message); }
else {
  console.log("Live query returned:", (live ?? []).length, "vehicles");
  if ((live ?? []).length > 0) {
    console.log("First result auctions array:", live[0].auctions);
  }
}

// 3) Alternative query: vehicle status in_auction + auctions embed
console.log("\n--- Alternative: vehicles.status=in_auction ---");
const { data: alt, error: e3 } = await sb
  .from("vehicles")
  .select(`id, make, model, year, status, auctions (id, status, end_time)`)
  .eq("status", "in_auction");
if (e3) { console.error("Alt error:", e3.message); }
else {
  console.log("Vehicles in_auction:", (alt ?? []).length);
  if (alt && alt.length > 0) {
    for (const v of alt.slice(0,5)) console.log(`  ${v.year} ${v.make} ${v.model}: auctions=${JSON.stringify(v.auctions)}`);
  }
}
