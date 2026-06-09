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

import { corsHeaders, jsonResponse, passthrough } from "../_shared/cors.ts";
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

  // Full model string incl. trim — trims move the price a lot.
  const modelQuery = trim ? `${model} ${trim}` : model;
  const qs = new URLSearchParams({
    apikey: AUTODEV_KEY,
    make,
    model: modelQuery,
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
    return passthrough(text, 200);
  } catch (e) {
    console.error("valuation-proxy: upstream fetch failed:", (e as Error)?.name ?? "error");
    return jsonResponse({ error: "upstream_unreachable" }, 502);
  }
});
