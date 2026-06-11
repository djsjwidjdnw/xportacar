// vin-decoder-proxy — server-side proxy for the auto.dev VIN decode API.
//
// The auto.dev API key lives ONLY in this function's environment
// (Deno.env AUTODEV_API_KEY) — never in the mobile bundle. The inspector app
// calls this via supabase.functions.invoke("vin-decoder-proxy", { body: { vin } }).
//
// Auth + CORS + rate limiting as in valuation-proxy. The upstream status is
// passed through so the client can still tell "not found" from other errors.
// The key is never returned in a response and never logged.

import { corsHeaders, jsonResponse, passthrough } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { rateLimited } from "../_shared/rateLimit.ts";

const AUTODEV_KEY = Deno.env.get("AUTODEV_API_KEY") ?? "";
// ISO 3779: 17 chars, excludes I, O, Q.
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const userId = await getUserId(req);
  if (!userId) return jsonResponse({ error: "unauthorized" }, 401);

  if (rateLimited(`vin:${userId}`)) {
    return jsonResponse({ error: "rate_limited", message: "Too many requests, slow down." }, 429);
  }

  if (!AUTODEV_KEY) {
    console.error("vin-decoder-proxy: AUTODEV_API_KEY is not set");
    return jsonResponse({ error: "not_configured" }, 503);
  }

  let body: { vin?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const vin = String(body.vin ?? "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) {
    return jsonResponse({ error: "invalid_vin", message: "VIN must be exactly 17 characters" }, 400);
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://api.auto.dev/vin/${encodeURIComponent(vin)}?apikey=${encodeURIComponent(AUTODEV_KEY)}`,
      { headers: { Authorization: `Bearer ${AUTODEV_KEY}`, Accept: "application/json" }, signal: ctrl.signal },
    );
    clearTimeout(timer);

    const text = await res.text();
    // TEMPORARY: log auto.dev's status + a body snippet (never the key) so VIN
    // decode behaviour is visible in the Supabase function logs. Safe to remove.
    console.log(`[vin-decoder-proxy] vin=${vin} upstream=${res.status} body=${text.slice(0, 300)}`);
    if (!res.ok) {
      // Pass the status through (400 invalid format, 404/422 = not found) so the
      // client can branch and fall back to manual entry.
      return passthrough(text, res.status);
    }
    return passthrough(text, 200);
  } catch (e) {
    console.error("vin-decoder-proxy: upstream fetch failed:", (e as Error)?.name ?? "error");
    return jsonResponse({ error: "upstream_unreachable" }, 502);
  }
});
