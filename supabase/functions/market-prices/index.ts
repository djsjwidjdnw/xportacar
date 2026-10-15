// market-prices — UAE vs EU market prices for one car. Built dormant.
//
// Callers (admins only, never a buyer page):
//   - web admin publishListingAction, after a publish or relist:
//       { action: "lookup", vehicle_id, trigger: "publish" | "relist" }
//     answers 202 at once and finishes in the background (EdgeRuntime.waitUntil);
//   - the admin vehicle page Refresh button:
//       { action: "lookup", vehicle_id, trigger: "refresh", force: true, wait: true }
//   - the admin Integrations page:
//       { action: "test", service: "vincario" | "apify", vehicle_id }   (refused while off)
//       { action: "status" }                                            (key last-4s only)
//
// Dormant: app_settings.market_prices_enabled off, or any Integrations key
// missing -> no external call, one log line, { status: "dormant", reason }.
// A result under 7 days old is reused (only the stale or failed side runs).
// The engine itself is in ../_shared/marketPrices.ts (unit-tested in Node).
//
// Keys: the three market-price keys live in Vault (written by the admin
// Integrations page through admin_set_market_price_key()) and are read here
// over SUPABASE_DB_URL. They never leave this function: not in a response, a
// log line or an error. The Vincario key is part of its URL, so fetch errors
// are reduced to codes and the URL is never logged. This function does not use
// the VINCARIO_API_KEY / AUTODEV_API_KEY secrets of the VIN decoder; it only
// reports whether they are set (last 4) for the Integrations page.

import postgres from "npm:postgres@3.4.5";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { rateLimited } from "../_shared/rateLimit.ts";
import {
  KEY_NAMES, prepareLookup, runLookup,
  type EngineDeps, type EngineKeys, type LookupOutcome, type PriceRow, type Side, type Trigger,
} from "../_shared/marketPrices.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

type Sql = ReturnType<typeof postgres>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOOKUP_TRIGGERS: Trigger[] = ["publish", "relist", "refresh"];
// Read-only status rows on the Integrations page (VIN decoding keys, untouched here).
const EDGE_KEYS = ["AUTODEV_API_KEY", "VINCARIO_API_KEY", "VINCARIO_SECRET_KEY"] as const;

const last4 = (v: string | null | undefined): string | null => (v && v.length >= 8 ? v.slice(-4) : null);
const iso = (v: unknown): string | null => (v == null ? null : new Date(v as string).toISOString());

function connect(): Sql {
  const url = Deno.env.get("SUPABASE_DB_URL");
  if (!url) throw new Error("SUPABASE_DB_URL is not set");
  return postgres(url, { max: 1, prepare: false, idle_timeout: 5, connect_timeout: 10 });
}

function engineDeps(sql: Sql): EngineDeps {
  return {
    async settings() {
      const rows = await sql`
        select key, value from public.app_settings
         where key in ('market_prices_enabled', 'market_prices_apify_actor')`;
      const map = new Map(rows.map((r) => [r.key as string, r.value as unknown]));
      const actor = map.get("market_prices_apify_actor");
      return { enabled: map.get("market_prices_enabled") === true, actor: typeof actor === "string" ? actor : null };
    },
    async keys() {
      const rows = await sql`
        select name, decrypted_secret from vault.decrypted_secrets
         where name in ${sql([...KEY_NAMES])}`;
      const keys = Object.fromEntries(KEY_NAMES.map((k) => [k, null])) as EngineKeys;
      for (const r of rows) {
        const v = typeof r.decrypted_secret === "string" ? r.decrypted_secret.trim() : "";
        if (v) keys[r.name as keyof EngineKeys] = v;
      }
      return keys;
    },
    async vehicle(id) {
      const [v] = await sql`select id, vin, make, model, year from public.vehicles where id = ${id}`;
      return v ? { id: v.id as string, vin: v.vin ?? null, make: v.make ?? null, model: v.model ?? null, year: v.year ?? null } : null;
    },
    async priceRow(id) {
      const [r] = await sql`
        select vehicle_id, uae_status, uae_fetched_at, eu_status, eu_fetched_at
          from public.vehicle_market_prices where vehicle_id = ${id}`;
      if (!r) return null;
      return {
        vehicle_id: r.vehicle_id, uae_status: r.uae_status, uae_fetched_at: iso(r.uae_fetched_at),
        eu_status: r.eu_status, eu_fetched_at: iso(r.eu_fetched_at),
      } as PriceRow;
    },
    async claim(id) {
      const rows = await sql`
        insert into public.vehicle_market_prices as p (vehicle_id, lookup_started_at)
        values (${id}, now())
        on conflict (vehicle_id) do update set lookup_started_at = now()
         where p.lookup_started_at is null or p.lookup_started_at < now() - interval '3 minutes'
        returning p.vehicle_id`;
      return rows.length > 0;
    },
    async save(id, patch) {
      const row: Record<string, unknown> = { ...patch, lookup_started_at: null, fetched_at: new Date() };
      await sql`update public.vehicle_market_prices set ${sql(row)} where vehicle_id = ${id}`;
    },
    async release(id) {
      await sql`update public.vehicle_market_prices set lookup_started_at = null where vehicle_id = ${id}`;
    },
    async fxToday() {
      const [r] = await sql`
        select eur_per_aed::float8 as rate, ecb_date::text as ecb_date from public.market_fx_rates
         where fetched_on = (now() at time zone 'utc')::date`;
      return r ? { eurPerAed: r.rate, ecbDate: r.ecb_date } : null;
    },
    async fxRecent() {
      const [r] = await sql`
        select eur_per_aed::float8 as rate, ecb_date::text as ecb_date from public.market_fx_rates
         where fetched_on >= (now() at time zone 'utc')::date - 7
         order by fetched_on desc limit 1`;
      return r ? { eurPerAed: r.rate, ecbDate: r.ecb_date } : null;
    },
    async saveFx(row) {
      await sql`insert into public.market_fx_rates ${sql(row)} on conflict (fetched_on) do nothing`;
    },
    async log(rows) {
      await sql`insert into public.market_price_lookups ${sql(rows)}`;
    },
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    info: (line) => console.log(line),
  };
}

// Integrations page status: whether each key is set and its last 4 characters.
async function status(sql: Sql, deps: EngineDeps) {
  const settings = await deps.settings();
  const rows = await sql`
    select name, right(decrypted_secret, 4) as last4, length(decrypted_secret) >= 8 as long_enough, updated_at
      from vault.decrypted_secrets where name in ${sql([...KEY_NAMES])}`;
  const vault = Object.fromEntries(KEY_NAMES.map((k) => [k, { set: false, last4: null as string | null, updated_at: null as string | null }]));
  for (const r of rows) {
    vault[r.name as string] = { set: true, last4: r.long_enough ? r.last4 : null, updated_at: iso(r.updated_at) };
  }
  const edge = Object.fromEntries(EDGE_KEYS.map((k) => {
    const v = Deno.env.get(k) ?? "";
    return [k, { set: v.length > 0, last4: last4(v) }];
  }));
  return { enabled: settings.enabled, actor: settings.actor, vault, edge, checked_at: new Date().toISOString() };
}

// Error text from Postgres is safe to log; anything else (fetch errors carry
// URLs) is reduced to its name.
function describe(e: unknown): string {
  const err = e as { name?: string; code?: string; message?: string };
  return err?.name === "PostgresError" ? `PostgresError ${err.code ?? ""} ${err.message ?? ""}`.trim() : (err?.name ?? "error");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const userId = await getUserId(req);
  if (!userId) return jsonResponse({ error: "unauthorized" }, 401);
  if (rateLimited(`market-prices:${userId}`, 20)) return jsonResponse({ error: "rate_limited" }, 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const action = String(body.action ?? "");

  let sql: Sql;
  try { sql = connect(); } catch {
    console.error("[market-prices] SUPABASE_DB_URL is not set");
    return jsonResponse({ error: "not_configured" }, 503);
  }

  let background = false;
  try {
    const [me] = await sql`select role from public.profiles where id = ${userId}`;
    if (!me || !["admin", "superadmin"].includes(String(me.role))) return jsonResponse({ error: "admin_only" }, 403);

    const deps = engineDeps(sql);
    if (action === "status") return jsonResponse(await status(sql, deps), 200);

    const vehicleId = String(body.vehicle_id ?? "");
    if (!UUID_RE.test(vehicleId)) return jsonResponse({ error: "invalid_vehicle_id" }, 400);

    let sides: Side[] | undefined;
    let trigger: Trigger;
    let force = body.force === true;
    let wait = body.wait === true;
    if (action === "test") {
      const service = String(body.service ?? "");
      if (service !== "vincario" && service !== "apify") return jsonResponse({ error: "invalid_service" }, 400);
      if (!(await deps.settings()).enabled) {
        return jsonResponse({ status: "dormant", reason: "disabled", error: "market_prices_off" }, 409);
      }
      sides = [service === "vincario" ? "eu" : "uae"];
      trigger = "test";
      force = true;
      wait = true;
    } else if (action === "lookup") {
      trigger = String(body.trigger ?? "") as Trigger;
      if (!LOOKUP_TRIGGERS.includes(trigger)) return jsonResponse({ error: "invalid_trigger" }, 400);
    } else {
      return jsonResponse({ error: "unknown_action" }, 400);
    }

    const prepared = await prepareLookup(deps, { vehicleId, trigger, force, sides });
    if ("outcome" in prepared) return jsonResponse(prepared.outcome, 200);

    if (!wait && typeof EdgeRuntime !== "undefined") {
      background = true;
      EdgeRuntime.waitUntil(
        runLookup(deps, prepared.job)
          .catch((e) => console.error(`[market-prices] lookup failed vehicle=${vehicleId}: ${describe(e)}`))
          .finally(() => sql.end({ timeout: 5 }).catch(() => {})),
      );
      return jsonResponse({ status: "started" }, 202);
    }
    const outcome: LookupOutcome = await runLookup(deps, prepared.job);
    return jsonResponse(outcome, 200);
  } catch (e) {
    console.error(`[market-prices] ${action || "request"} failed: ${describe(e)}`);
    return jsonResponse({ error: "internal_error" }, 500);
  } finally {
    if (!background) await sql.end({ timeout: 5 }).catch(() => {});
  }
});
