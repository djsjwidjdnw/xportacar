// Re-seeds vehicle photos with per-make/model curated picks and restaggers
// auction end_times so all 12 auctions are active, ending between NOW+2h and
// NOW+96h.  Runs against the live Supabase project using the service-role key
// (no Management API PAT required — uses PostgREST under the hood).
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/fix-photos-and-auctions.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://klettmjnnttajdyajafn.supabase.co";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

if (!SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY before running.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Photo pool ----------------------------------------------------
// 10 Unsplash IDs that the original seed has been serving successfully.
// Re-assigned below so each make has a visually coherent identity.
const P = {
  mercedes:   "1606664515524-ed2f786a0bd6", // luxury front - reads "Mercedes"
  bmw:        "1556189250-72ba954cfc2b",    // BMW M
  porsche:    "1503376780353-7e6692767b70", // white sports car
  audi:       "1542362567-b07e54358753",    // Audi front
  rangerover: "1605559424843-9e4c228bf1c2", // rear quarter
  suv:        "1568844293986-8d0400bd4745", // off-road / Land Cruiser-style
  redCar:     "1494976388531-d1058494cdd8", // red car at sunset
  interior:   "1492144534655-ae79c964c9d7", // cockpit
  dashboard:  "1503736334956-4c8f8e92946d", // dashboard close-up
  engine:     "1555215695-3004980ad54e",    // engine bay
};

const u = (id) => `https://images.unsplash.com/photo-${id}?w=1600&q=80`;

// Each vehicle gets a make-coherent hero + supporting shots.
const PHOTOS_BY_VEHICLE = [
  // 1 Mercedes-Benz GLE 450 — Obsidian Black SUV
  ["11111111-0001-0000-0000-000000000001", [
    [P.mercedes,   "exterior", "Front three-quarter"],
    [P.rangerover, "exterior", "Rear three-quarter"],
    [P.interior,   "interior", "Cockpit"],
    [P.dashboard,  "interior", "MBUX dashboard"],
    [P.engine,     "engine",   "Inline-6 mild hybrid"],
  ]],
  // 2 BMW X5 xDrive40i M Sport — Carbon Black
  ["11111111-0001-0000-0000-000000000002", [
    [P.bmw,        "exterior", "Front three-quarter"],
    [P.redCar,     "exterior", "Side profile"],
    [P.rangerover, "exterior", "Rear"],
    [P.interior,   "interior", "M Sport cabin"],
    [P.dashboard,  "interior", "Live Cockpit Pro"],
  ]],
  // 3 Porsche Cayenne S — Carrara White SUV
  ["11111111-0001-0000-0000-000000000003", [
    [P.porsche,    "exterior", "Carrara White — front three-quarter"],
    [P.rangerover, "exterior", "Rear quarter"],
    [P.interior,   "interior", "Sport Chrono cockpit"],
    [P.dashboard,  "interior", "PCM 6.0"],
  ]],
  // 4 Land Rover Range Rover Sport HSE Dynamic — Santorini Black
  ["11111111-0001-0000-0000-000000000004", [
    [P.rangerover, "exterior", "Front three-quarter"],
    [P.suv,        "exterior", "Side profile"],
    [P.interior,   "interior", "Windsor leather cabin"],
    [P.dashboard,  "interior", "Pivi Pro cockpit"],
  ]],
  // 5 Audi Q8 55 TFSI quattro S line — Glacier White
  ["11111111-0001-0000-0000-000000000005", [
    [P.audi,       "exterior", "S line front"],
    [P.redCar,     "exterior", "Side profile"],
    [P.interior,   "interior", "Virtual Cockpit Plus"],
    [P.dashboard,  "interior", "MMI touch"],
  ]],
  // 6 Toyota Land Cruiser VXR 300 — Pearl White
  ["11111111-0001-0000-0000-000000000006", [
    [P.suv,        "exterior", "VXR — front three-quarter"],
    [P.rangerover, "exterior", "Rear quarter"],
    [P.interior,   "interior", "Tan leather cabin"],
    [P.dashboard,  "interior", "Multi-Terrain console"],
  ]],
  // 7 Lexus LX 600 Ultra Luxury — Sonic Quartz
  ["11111111-0001-0000-0000-000000000007", [
    [P.suv,        "exterior", "Ultra Luxury — front"],
    [P.redCar,     "exterior", "Side profile"],
    [P.interior,   "interior", "Rear ottoman cabin"],
    [P.dashboard,  "interior", "Mark Levinson console"],
  ]],
  // 8 Nissan Patrol Platinum LE — Galaxy Black
  ["11111111-0001-0000-0000-000000000008", [
    [P.suv,        "exterior", "Platinum LE — front"],
    [P.rangerover, "exterior", "Rear"],
    [P.interior,   "interior", "Quilted leather cabin"],
    [P.dashboard,  "interior", "BOSE console"],
  ]],
  // 9 Mercedes-Benz S 500 4MATIC — Selenite Grey Sedan
  ["11111111-0001-0000-0000-000000000009", [
    [P.mercedes,   "exterior", "LWB front three-quarter"],
    [P.rangerover, "exterior", "Rear quarter"],
    [P.interior,   "interior", "Executive rear lounge"],
    [P.dashboard,  "interior", "MBUX hyperscreen"],
  ]],
  // 10 BMW 740Li xDrive M Sport — Aventurin Red
  ["11111111-0001-0000-0000-000000000010", [
    [P.bmw,        "exterior", "Front three-quarter"],
    [P.redCar,     "exterior", "Aventurin Red — side"],
    [P.interior,   "interior", "Executive Lounge"],
    [P.dashboard,  "interior", "BMW iDrive 8.5"],
  ]],
  // 11 Audi A8 L 60 TFSI quattro — Mythos Black
  ["11111111-0001-0000-0000-000000000011", [
    [P.audi,       "exterior", "A8 L — front three-quarter"],
    [P.rangerover, "exterior", "Rear quarter"],
    [P.interior,   "interior", "Valcona rear cabin"],
    [P.dashboard,  "interior", "Audi Virtual Cockpit"],
  ]],
  // 12 Porsche Macan GTS — Carmine Red
  ["11111111-0001-0000-0000-000000000012", [
    [P.redCar,     "exterior", "Carmine Red — front"],
    [P.porsche,    "exterior", "Side profile"],
    [P.interior,   "interior", "GTS Race-Tex cockpit"],
    [P.dashboard,  "interior", "PCM with Sport Chrono"],
  ]],
];

// --- Auction stagger ----------------------------------------------
// Hottest auctions (most bids) end soonest.  All 12 are made active so
// they appear on /auctions.
const AUCTION_STAGGER = [
  // auction_id                                  endInHours  startInHours (negative=past)
  ["22222222-0001-0000-0000-000000000003",  2, -72], // Cayenne — 8 bids, hottest
  ["22222222-0001-0000-0000-000000000001",  6, -48], // GLE — 6 bids
  ["22222222-0001-0000-0000-000000000006", 12, -24], // Land Cruiser — 5 bids
  ["22222222-0001-0000-0000-000000000002", 18, -36], // X5 — 4 bids
  ["22222222-0001-0000-0000-000000000010", 24, -12], // 740Li — 4 bids
  ["22222222-0001-0000-0000-000000000005", 36, -24], // Q8 — 3 bids
  ["22222222-0001-0000-0000-000000000012", 48, -18], // Macan — 3 bids
  ["22222222-0001-0000-0000-000000000008", 60, -8],  // Patrol — 2 bids
  ["22222222-0001-0000-0000-000000000004", 72, -2],  // Range Rover — 0 bids
  ["22222222-0001-0000-0000-000000000007", 84, -1],  // LX — 0 bids
  ["22222222-0001-0000-0000-000000000009", 90, -1],  // S500 — 0 bids
  ["22222222-0001-0000-0000-000000000011", 96, -1],  // A8 — 0 bids
];

const VEHICLES_IN_AUCTION = AUCTION_STAGGER.map(([_, __, ___], i) => i); // 0..11

// ---------------------------------------------------------------

async function step(name, fn) {
  process.stdout.write(`▶ ${name}\n`);
  const t0 = Date.now();
  await fn();
  console.log(`✓ ${name}  (${Date.now() - t0}ms)`);
}

await step("Delete all vehicle_photos", async () => {
  const { error } = await sb
    .from("vehicle_photos")
    .delete()
    .neq("vehicle_id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
});

await step("Insert curated photos (per make)", async () => {
  const rows = [];
  for (const [vid, photos] of PHOTOS_BY_VEHICLE) {
    photos.forEach(([id, category, caption], i) => {
      rows.push({
        vehicle_id: vid,
        url: u(id),
        category,
        sort_order: i,
        caption,
      });
    });
  }
  const { error } = await sb.from("vehicle_photos").insert(rows);
  if (error) throw error;
  console.log(`  inserted ${rows.length} rows`);
});

await step("Restagger auction end_times (all 12 active)", async () => {
  for (const [aid, endH, startH] of AUCTION_STAGGER) {
    const endTime = new Date(Date.now() + endH * 3600_000).toISOString();
    const startTime = new Date(Date.now() + startH * 3600_000).toISOString();
    const { error } = await sb
      .from("auctions")
      .update({ status: "active", end_time: endTime, start_time: startTime })
      .eq("id", aid);
    if (error) throw error;
  }
});

await step("Flip vehicle status to in_auction for all 12", async () => {
  const vids = PHOTOS_BY_VEHICLE.map(([v]) => v);
  const { error } = await sb
    .from("vehicles")
    .update({ status: "in_auction" })
    .in("id", vids);
  if (error) throw error;
});

await step("Sanity counts", async () => {
  const { count: photos } = await sb
    .from("vehicle_photos").select("*", { count: "exact", head: true });
  const { count: liveAuctions } = await sb
    .from("auctions").select("*", { count: "exact", head: true }).eq("status", "active");
  const { count: inAuctionVehicles } = await sb
    .from("vehicles").select("*", { count: "exact", head: true }).eq("status", "in_auction");
  console.log(`  photos=${photos}  active_auctions=${liveAuctions}  in_auction_vehicles=${inAuctionVehicles}`);
});

console.log("\n✅ Done.");
