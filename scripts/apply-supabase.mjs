// One-off bootstrap: applies migration + creates demo users + applies seed
// against a Supabase project, using the Management API for SQL and the
// Auth admin endpoint for users.  Safe to re-run — both SQL files are
// idempotent (migration creates types/tables that error gracefully if
// re-run; seed truncates first), and user creation skips on "already exists".

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PROJECT_REF      = "klettmjnnttajdyajafn";
const PROJECT_URL      = `https://${PROJECT_REF}.supabase.co`;
const MGMT_TOKEN       = process.env.SUPABASE_PAT;          // sbp_…
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE; // sb_secret_…

if (!MGMT_TOKEN || !SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_PAT and SUPABASE_SERVICE_ROLE env vars before running.");
  process.exit(1);
}

const DEMO_USERS = [
  { email: "admin@xportacar.com",     full_name: "Sarah Al-Mansouri",   role: "admin" },
  { email: "buyer@xportacar.com",     full_name: "Klaus Weber",         role: "buyer" },
  { email: "inspector@xportacar.com", full_name: "Mohammed Al-Hashimi", role: "inspector" },
  { email: "buyer2@xportacar.com",    full_name: "Pierre Dubois",       role: "buyer" },
  { email: "buyer3@xportacar.com",    full_name: "Marco Rossi",         role: "buyer" },
];
const DEMO_PASSWORD = "Demo!1234";

// --- HTTP helpers ---------------------------------------------------

async function runSql(query, label) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MGMT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${label}] ${res.status} ${res.statusText}\n${text}`);
  }
  return text;
}

async function createUser(user) {
  const res = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.full_name, role: user.role },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { status: "created", id: body?.id };
  // Already exists — Supabase returns 422 "User already registered" or similar.
  const msg = (body?.msg || body?.message || JSON.stringify(body)).toLowerCase();
  if (res.status === 422 || msg.includes("already")) {
    return { status: "exists" };
  }
  throw new Error(`[${user.email}] ${res.status} ${JSON.stringify(body)}`);
}

// --- Steps ----------------------------------------------------------

async function step(name, fn) {
  process.stdout.write(`\n▶ ${name}\n`);
  const t0 = Date.now();
  const out = await fn();
  console.log(`✓ ${name}  (${Date.now() - t0}ms)`);
  return out;
}

await step("Ping", async () => {
  const r = await runSql("select version() as v;", "ping");
  console.log("  ", r.slice(0, 200));
});

await step("Apply migration (001_initial_schema.sql)", async () => {
  const sql = await fs.readFile(
    path.join(ROOT, "supabase", "migrations", "001_initial_schema.sql"),
    "utf8",
  );
  await runSql(sql, "migration");
});

await step("Create demo users via Auth admin API", async () => {
  for (const u of DEMO_USERS) {
    const r = await createUser(u);
    console.log(`  · ${u.email.padEnd(28)} ${r.status}${r.id ? `  ${r.id}` : ""}`);
  }
});

await step("Apply seed (seed.sql)", async () => {
  const sql = await fs.readFile(path.join(ROOT, "supabase", "seed.sql"), "utf8");
  await runSql(sql, "seed");
});

await step("Sanity check — counts", async () => {
  const r = await runSql(
    `select
       (select count(*) from public.profiles)        as profiles,
       (select count(*) from public.vehicles)        as vehicles,
       (select count(*) from public.vehicle_photos)  as photos,
       (select count(*) from public.vehicle_damages) as damages,
       (select count(*) from public.auctions)        as auctions,
       (select count(*) from public.bids)            as bids,
       (select count(*) from public.watchlist)       as watchlist;`,
    "counts",
  );
  console.log("  ", r);
});

console.log("\n✅ All done.");
