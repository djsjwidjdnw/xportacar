// valuation-proxy — server-side proxy for the auto.dev listings (valuation) API.
//
// The auto.dev API key lives ONLY in this function's environment
// (Deno.env AUTODEV_API_KEY, set via `supabase secrets set`) — never in the
// mobile bundle. The mobile apps call this via supabase.functions.invoke(
// "valuation-proxy", { body: { make, model, year, trim?, mileage? } }).
//
// Auth: the platform verifies the caller's Supabase JWT (verify_jwt default on)
// and we re-check it here. CORS for the web export. Best-effort rate limiting.
// The key is never returned in a response and never logged.

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { rateLimited } from "../_shared/rateLimit.ts";

const AUTODEV_KEY = Deno.env.get("AUTODEV_API_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const userId = await getUserId(req);
  if (!userId) return jsonResponse({ error: "unauthorized" }, 401);

  if (rateLimited(`valuation:${userId}`)) {
    return jsonResponse({ error: "rate_limited", message: "Too many requests, slow down." }, 429);
  }

  if (!AUTODEV_KEY) {
    console.error("valuation-proxy: AUTODEV_API_KEY is not set");
    return jsonResponse({ error: "not_configured" }, 503);
  }

  let body: { make?: string; model?: string; year?: number | string; trim?: string; mileage?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const make = String(body.make ?? "").trim();
  const model = String(body.model ?? "").trim();
  const trim = String(body.trim ?? "").trim();
  const year = Number(body.year);
  if (!make || !model || !Number.isFinite(year) || year < 1900 || year > 2100) {
    return jsonResponse(
      { error: "invalid_input", message: "make, model and a valid year are required" },
      400,
    );
  }

  // Query the BASE model only. auto.dev's `model` param expects the model name
  // ("Aventador"); passing "Aventador SVJ" returns ZERO records. Trim lives on
  // each returned record (record.trim, e.g. "LP 770-4 SVJ"), so the CLIENT
  // filters/aggregates by trim — that's what makes a base→SVJ swap change the
  // value. We forward `trim` only for the usage log below.
  const qs = new URLSearchParams({
    apikey: AUTODEV_KEY,
    make,
    model,
    year_min: String(year),
    year_max: String(year),
  });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`https://auto.dev/api/listings?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${AUTODEV_KEY}`, Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      console.error(`valuation-proxy: upstream returned ${res.status}`);
      return jsonResponse({ error: "upstream_error", status: res.status }, 502);
    }

    // PROVENANCE: auto.dev is a US-market listings API. It exposes NO country /
    // region / lat-lng filter (only US `zip`+`distance` and `retailListing.state`)
    // and returns ZERO UAE/GCC records, so these figures are US comparables, not
    // UAE prices. Adding a fake UAE zip/state would just return 0 records and
    // silently break valuation. We therefore keep the US query and TAG the
    // response so the client can show an honest "US market reference — limited
    // UAE coverage" note. Real UAE valuation needs a different data source.
    let j: { records?: Record<string, unknown>[] } & Record<string, unknown> = {};
    try { j = JSON.parse(text); } catch { /* keep {} on parse failure */ }
    const nums = (j.records ?? [])
      .map((r) => Number(r.priceUnformatted))
      .filter((n) => Number.isFinite(n) && n > 1000);
    const avg = nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;
    console.log(`[valuation-proxy] year=${year} make=${make} model=${model} trim=${trim || "-"} records=${nums.length} price=$${avg}`);

    return jsonResponse({
      ...j,
      market: "US",
      source: "auto.dev",
      note: nums.length
        ? "Reference based on US market comparables — UAE/GCC listings are not available from this source."
        : "Limited market data — estimate based on regional comparables.",
    }, 200);
  } catch (e) {
    console.error("valuation-proxy: upstream fetch failed:", (e as Error)?.name ?? "error");
    return jsonResponse({ error: "upstream_unreachable" }, 502);
  }
});
