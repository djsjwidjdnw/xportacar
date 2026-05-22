// Demo data: marks 2 auctions as "sold" with a winner so the admin/finance
// + admin/invoices pages have meaningful rows to display.  The
// trg_auctions_invoice trigger auto-creates the invoice row.
import { createClient } from "@supabase/supabase-js";
const sb = createClient(
  "https://klettmjnnttajdyajafn.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Pick the demo buyer.
const { data: buyer } = await sb.from("profiles").select("id, full_name, email").eq("role", "buyer").limit(1).single();
if (!buyer) { console.error("No buyer profile found."); process.exit(1); }
console.log("Winner →", buyer.email, buyer.id);

// Pick 2 auctions to flip to sold.
const TARGET_IDS = [
  "22222222-0001-0000-0000-000000000003", // Cayenne
  "22222222-0001-0000-0000-000000000010", // 740Li
];

for (const aid of TARGET_IDS) {
  const { data: a } = await sb.from("auctions").select("id, current_bid_eur, starting_price_eur, vehicle_id").eq("id", aid).single();
  if (!a) { console.log(aid, "→ not found"); continue; }
  const hammer = a.current_bid_eur ?? a.starting_price_eur;

  const { error } = await sb
    .from("auctions")
    .update({
      status: "sold",
      winner_id: buyer.id,
      end_time: new Date(Date.now() - 24 * 3600_000).toISOString(),
      current_bid_eur: hammer,
    })
    .eq("id", aid);
  console.log(aid, "→", error?.message ?? `sold at ${hammer}`);

  await sb.from("vehicles").update({ status: "sold" }).eq("id", a.vehicle_id);
}

// The trigger should have created invoices automatically.  Read them back.
const { data: invoices, count } = await sb
  .from("invoices")
  .select("id, invoice_number, total_eur, status, auction_id", { count: "exact" })
  .order("created_at", { ascending: false });
console.log(`\nInvoices now: ${count}`);
(invoices ?? []).forEach((i) => console.log("  ", i.invoice_number, "·", i.status, "·", i.total_eur));

// Mark one paid so we have a paid/pending mix.
if (invoices?.[0]) {
  const { error } = await sb
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoices[0].id);
  console.log("\nMarked first invoice paid:", error?.message ?? "ok");
}

console.log("\nDone.");
