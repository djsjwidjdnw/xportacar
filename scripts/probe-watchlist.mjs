// Probes the watchlist table for buyer@xportacar.com and replicates the
// mobile WatchlistScreen's two-step load so we can see what's actually
// being returned by the live DB.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/probe-watchlist.mjs

import { createClient } from "@supabase/supabase-js";

const URL = "https://klettmjnnttajdyajafn.supabase.co";
const SR  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;
if (!SR) { console.error("Set SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const sb = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: users } = await sb.auth.admin.listUsers();
const buyer = (users?.users ?? []).find((u) => u.email === "buyer@xportacar.com");
if (!buyer) { console.error("No buyer@xportacar.com auth user"); process.exit(2); }
console.log("buyer user id:", buyer.id);

const { data: rows, error } = await sb
  .from("watchlist")
  .select("user_id, vehicle_id, created_at")
  .eq("user_id", buyer.id);
if (error) { console.error("watchlist error:", error.message); process.exit(3); }
console.log("watchlist rows for buyer:", (rows ?? []).length);
for (const r of rows ?? []) console.log("  vehicle_id:", r.vehicle_id, "at", r.created_at);

if ((rows ?? []).length === 0) {
  console.log("\n→ Watchlist is EMPTY. The heart-tap presumably isn't writing.");
  console.log("→ Seeding 3 rows now so the WatchlistScreen has something to render.");
  const { data: someVehicles } = await sb
    .from("vehicles").select("id").in("status", ["listed", "in_auction"]).limit(3);
  const seed = (someVehicles ?? []).map((v) => ({ user_id: buyer.id, vehicle_id: v.id }));
  if (seed.length > 0) {
    const { error: insErr } = await sb.from("watchlist").insert(seed);
    if (insErr) console.error("seed error:", insErr.message);
    else console.log("seeded", seed.length, "watchlist rows");
  }
}

// Now replicate the two-step screen load.
const { data: rows2 } = await sb
  .from("watchlist").select("vehicle_id").eq("user_id", buyer.id);
const ids = (rows2 ?? []).map((r) => r.vehicle_id);
console.log("\nstep 1: vehicle_ids", ids);
if (ids.length === 0) { console.log("nothing to fetch"); process.exit(0); }

const { data: vehicles, error: err2 } = await sb
  .from("vehicles")
  .select(`
    *,
    vehicle_photos (url, sort_order),
    auctions (id, vehicle_id, status, end_time, current_bid_eur)
  `)
  .in("id", ids);
if (err2) { console.error("step 2 error:", err2.message); process.exit(4); }
console.log("\nstep 2: vehicles returned", (vehicles ?? []).length);
for (const v of vehicles ?? []) {
  const aShape = Array.isArray(v.auctions) ? `array(${v.auctions.length})` : (v.auctions ? "object" : "null");
  console.log(`  ${v.year} ${v.make} ${v.model}  · photos=${(v.vehicle_photos ?? []).length}  · auctions shape=${aShape}`);
}
