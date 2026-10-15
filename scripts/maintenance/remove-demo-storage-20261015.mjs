// Removes the 20 vehicle-photos objects of the App Review demo listing, orphaned
// by supabase/manual/20261015_delete_demo_listing.sql. Run ONLY after that delete
// has been applied. Names come from public.recovery_20261015_storage_objects, so
// exactly the recorded demo files are removed — nothing else.
//
// usage: node scripts/maintenance/remove-demo-storage-20261015.mjs --confirm
// needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local).
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm (deletes Storage files).");
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { count: stillThere } = await admin
  .from("vehicles").select("id", { count: "exact", head: true })
  .eq("id", "5f4e3424-89fa-43e8-b05d-d9fe795e31ff");
if (stillThere) {
  console.error("The demo vehicle still exists — apply the SQL delete first.");
  process.exit(1);
}
const { data, error } = await admin.from("recovery_20261015_storage_objects").select("bucket_id, name");
if (error) { console.error(error.message); process.exit(1); }
if (data.length !== 20 || data.some((o) => o.bucket_id !== "vehicle-photos")) {
  console.error(`Expected 20 vehicle-photos objects, found ${data.length}; stopping.`);
  process.exit(1);
}
const names = data.map((o) => o.name);
const { data: removed, error: e } = await admin.storage.from("vehicle-photos").remove(names);
if (e) { console.error(e.message); process.exit(1); }
console.log(`removed ${removed?.length ?? 0} of ${names.length} objects from vehicle-photos`);
