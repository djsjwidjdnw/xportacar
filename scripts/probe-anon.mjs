import { createClient } from "@supabase/supabase-js";

const URL = "https://klettmjnnttajdyajafn.supabase.co";
const ANON = "sb_publishable_rawIwWZv12q9_VxVuaMOWQ_A2oXTEJ_";
const sb = createClient(URL, ANON);

// Sign in as buyer
const { data: auth, error: aerr } = await sb.auth.signInWithPassword({
  email: "buyer@xportacar.com",
  password: "Demo!1234",
});
if (aerr) { console.error("auth error:", aerr.message); process.exit(1); }
console.log("Authed as:", auth.user?.email, auth.user?.id);

// 1. watchlist rows
const { data: wl, error: werr } = await sb
  .from("watchlist").select("vehicle_id").eq("user_id", auth.user.id);
console.log("watchlist rows:", wl?.length ?? 0, werr?.message ?? "");
const ids = (wl ?? []).map(r => r.vehicle_id);
console.log("ids:", ids);

// 2. fetch vehicles
if (ids.length === 0) { console.log("no ids"); process.exit(0); }
const { data: vs, error: verr } = await sb
  .from("vehicles")
  .select(`*, vehicle_photos (url, sort_order), auctions (id, vehicle_id, status, end_time, current_bid_eur)`)
  .in("id", ids);
console.log("vehicles error:", verr?.message ?? "none");
console.log("vehicles returned:", vs?.length ?? 0);
for (const v of (vs ?? [])) {
  console.log(`  ${v.year} ${v.make} ${v.model}  status=${v.status}  photos=${v.vehicle_photos?.length}  auctions=${Array.isArray(v.auctions) ? 'arr' : (v.auctions ? 'obj' : 'null')}`);
}
