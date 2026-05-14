// Apply supabase/migrations/002_phase2_features.sql against the live
// project.  Needs the Management API PAT (sbp_...).
//
//   SUPABASE_PAT=sbp_... node scripts/apply-phase2.mjs
//
// Run once to enable counter offers, invoices, saved searches, shipping
// quotes, KYC submissions, push tokens, and proxy-bid columns.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "klettmjnnttajdyajafn";
const PAT = process.env.SUPABASE_PAT;
if (!PAT) {
  console.error("Set SUPABASE_PAT (sbp_…) before running.");
  process.exit(1);
}

const sql = await fs.readFile(
  path.join(__dirname, "..", "supabase", "migrations", "002_phase2_features.sql"),
  "utf8",
);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  },
);
const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}
console.log("✓ migration applied");
console.log(text.slice(0, 300));
