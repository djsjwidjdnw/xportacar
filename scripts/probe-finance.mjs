import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://klettmjnnttajdyajafn.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const tables = ["invoices", "counter_offers", "shipping_quotes", "saved_searches", "kyc_documents"];
for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(`${t}: ${error ? "ERR " + error.message : `${count} rows`}`);
}

const { data: sold } = await sb
  .from("auctions")
  .select("id, vehicle_id, winner_id, current_bid_eur, buy_now_price_eur, end_time")
  .or("status.eq.sold,status.eq.ended")
  .not("winner_id", "is", null);
console.log(`\nsold auctions with winners: ${sold?.length ?? 0}`);
if (sold?.length) console.log(JSON.stringify(sold.slice(0, 3), null, 2));

const { data: invSchema } = await sb.from("invoices").select("*").limit(1);
console.log(`\ninvoice sample row:`, invSchema?.[0] ?? "(empty table)");
