import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const sb = createClient(
  "https://klettmjnnttajdyajafn.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const sql = readFileSync("supabase/migrations/003_platform_settings.sql", "utf8");

// Try calling a SQL exec RPC if it exists; otherwise use the direct REST API.
// (We have apply-supabase.mjs that already does this — easiest path is to
// shell out to it, but for clarity here we'll just split the file into
// statements and run them through PostgREST.)

// PostgREST doesn't run DDL, so use the Postgres connection string.
// Easier: use supabase.rpc("exec_sql", { sql }) if it exists.
const { error } = await sb.rpc("exec_sql", { sql });
console.log("rpc exec_sql →", error?.message ?? "ok");
