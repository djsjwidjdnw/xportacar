import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://klettmjnnttajdyajafn.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
// Try inserting a stub row and read the error to learn columns
const { error: e1 } = await sb.from("invoices").insert({ id: "00000000-0000-0000-0000-000000000000" });
console.log("insert stub →", e1?.message ?? "ok");

// Better: use RPC to get column names via information_schema using a function — won't have one,
// so just try a SELECT with * limit 0 to see the response shape
console.log("\nTrying typed selects:");
for (const cols of [
  "id, invoice_number",
  "id, invoice_number, status, total_eur, hammer_eur, platform_fee_eur, vehicle_id, auction_id, buyer_id, created_at",
  "id, invoice_number, status, total_eur, fee_eur, vehicle_id, auction_id, buyer_id",
]) {
  const { error } = await sb.from("invoices").select(cols).limit(1);
  console.log(cols, "→", error?.message ?? "ok");
}
