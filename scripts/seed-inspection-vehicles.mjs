// Seeds 3 vehicles with status "inspection_scheduled" assigned to the demo
// inspector (inspector@xportacar.com) so the inspection app dashboard has
// real vehicles to inspect. Idempotent: re-running re-assigns the same VINs
// rather than creating duplicates.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-inspection-vehicles.mjs
//   (or)  node --env-file=.env.local scripts/seed-inspection-vehicles.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://klettmjnnttajdyajafn.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

if (!KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY before running.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const INSPECTOR_EMAIL = "inspector@xportacar.com";

// --- Resolve the demo inspector ------------------------------------
let { data: inspector } = await sb
  .from("profiles")
  .select("id, email, role")
  .eq("email", INSPECTOR_EMAIL)
  .maybeSingle();

if (!inspector) {
  // Fall back to any inspector if the demo email isn't present.
  const { data: anyInspector } = await sb
    .from("profiles")
    .select("id, email, role")
    .eq("role", "inspector")
    .limit(1)
    .maybeSingle();
  inspector = anyInspector;
}

if (!inspector) {
  console.error("No inspector profile found — create inspector@xportacar.com first.");
  process.exit(1);
}
console.log(`Assigning to inspector: ${inspector.email ?? inspector.id}`);

// --- Vehicles to schedule for inspection ---------------------------
const VEHICLES = [
  { vin: "INSPECT0000000001", make: "Toyota",        model: "Land Cruiser VXR", year: 2022, mileage_km: 38000, exterior_color: "Pearl White",   body_type: "SUV", seller_name: "Khalid Reseller", seller_phone: "+971 50 111 2233", location_city: "Dubai" },
  { vin: "INSPECT0000000002", make: "Nissan",        model: "Patrol Platinum",  year: 2021, mileage_km: 52000, exterior_color: "Galaxy Black",  body_type: "SUV", seller_name: "Mariam Auto",     seller_phone: "+971 55 444 5566", location_city: "Abu Dhabi" },
  { vin: "INSPECT0000000003", make: "Mercedes-Benz", model: "G 63 AMG",         year: 2023, mileage_km: 14000, exterior_color: "Obsidian Black",body_type: "SUV", seller_name: "Gulf Motors",     seller_phone: "+971 52 777 8899", location_city: "Dubai" },
];

let inserted = 0, updated = 0;
for (const v of VEHICLES) {
  const { data: existing } = await sb
    .from("vehicles").select("id").eq("vin", v.vin).maybeSingle();

  if (existing) {
    const { error } = await sb
      .from("vehicles")
      .update({ inspector_id: inspector.id, status: "inspection_scheduled" })
      .eq("id", existing.id);
    if (error) { console.log(`  ✗ update ${v.vin}: ${error.message}`); continue; }
    updated++;
    console.log(`  ↻ re-assigned ${v.year} ${v.make} ${v.model}`);
    continue;
  }

  const { error } = await sb.from("vehicles").insert({
    ...v,
    fuel_type: "petrol",
    transmission: "automatic",
    location_country: "UAE",
    status: "inspection_scheduled",
    inspector_id: inspector.id,
    created_by: inspector.id,
  });
  if (error) { console.log(`  ✗ insert ${v.vin}: ${error.message}`); continue; }
  inserted++;
  console.log(`  ✓ scheduled ${v.year} ${v.make} ${v.model}`);
}

const { count } = await sb
  .from("vehicles")
  .select("*", { count: "exact", head: true })
  .eq("inspector_id", inspector.id)
  .eq("status", "inspection_scheduled");

console.log(`\nInserted ${inserted}, re-assigned ${updated}.`);
console.log(`Inspector now has ${count} vehicle(s) awaiting inspection.`);
console.log("✅ Done.");
