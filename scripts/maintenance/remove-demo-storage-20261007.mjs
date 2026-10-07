// Removes the 53 vehicle-photos objects orphaned by
// supabase/manual/20261007_delete_demo_content.sql. Run ONLY after that delete
// has been applied. Names come from public.recovery_20261007_storage_objects,
// so exactly the recorded demo files are removed — nothing else.
//
// usage: node scripts/maintenance/remove-demo-storage-20261007.mjs --confirm
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
  .in("id", ["d05628ec-ceb6-482a-9af5-bd76bf99dd06", "0210be9c-5646-4715-8392-6591f5c581f2"]);
if (stillThere) {
  console.error("The demo vehicles still exist — apply the SQL delete first.");
  process.exit(1);
}
const { data, error } = await admin.from("recovery_20261007_storage_objects").select("bucket_id, name");
if (error) { console.error(error.message); process.exit(1); }
const byBucket = {};
for (const o of data) (byBucket[o.bucket_id] ??= []).push(o.name);
for (const [bucket, names] of Object.entries(byBucket)) {
  for (let i = 0; i < names.length; i += 100) {
    const { error: e } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
    if (e) { console.error(bucket, e.message); process.exit(1); }
  }
  console.log(`removed ${names.length} objects from ${bucket}`);
}
