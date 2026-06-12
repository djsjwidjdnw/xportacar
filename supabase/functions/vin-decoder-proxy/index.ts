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
    if (!res.ok) {
      // Pass the status through (400 invalid format, 404/422 = not found) so the
      // client can branch and fall back to manual entry.
      console.log(`[vin-decoder-proxy] vin=${vin} autodev=${res.status} (passthrough)`);
      return passthrough(text, res.status);
    }

    // auto.dev coverage for exotic/low-volume cars is inconsistent — many VINs
    // come back with only year+make. Enrich the gaps from NHTSA vPIC (free, no
    // key, broad global coverage), filling ONLY the fields auto.dev left empty,
    // writing into the keys the mobile parser already reads.
    // deno-lint-ignore no-explicit-any
    let j: any;
    try { j = JSON.parse(text); } catch { return passthrough(text, 200); }

    const before = { model: !!j.model, trim: !!j.trim, transmission: !!j.transmission, drive: !!j.drive, fuel: !!j.fuel, body: !!j.body };
    const nhtsa = await fetchNhtsa(vin);
    if (nhtsa) {
      const fill = (key: string, val?: string) => {
        if (val && val.trim() && (!j[key] || String(j[key]).trim() === "")) j[key] = val.trim();
      };
      fill("make", nhtsa.Make);
      fill("model", nhtsa.Model);
      fill("trim", nhtsa.Trim || nhtsa.Series);
      fill("transmission", nhtsa.TransmissionStyle);
      fill("drive", nhtsa.DriveType);
      fill("fuel", nhtsa.FuelTypePrimary);
      fill("body", nhtsa.BodyClass);
      fill("displacement", nhtsa.DisplacementL);
      fill("cylinders", nhtsa.EngineCylinders);
      // Year: auto.dev keeps it in vehicle.year; fill if missing.
      if (nhtsa.ModelYear && (!j.vehicle || !j.vehicle.year)) {
        j.vehicle = { ...(j.vehicle ?? {}), year: Number(nhtsa.ModelYear) || nhtsa.ModelYear };
      }
    }

    console.log(`[vin-decoder-proxy] vin=${vin} autodev=200 nhtsa=${nhtsa ? "ok" : "none"} ` +
      `filled={model:${!before.model && !!j.model},trim:${!before.trim && !!j.trim},` +
      `transmission:${!before.transmission && !!j.transmission},drive:${!before.drive && !!j.drive},` +
      `fuel:${!before.fuel && !!j.fuel},body:${!before.body && !!j.body}}`);

    return jsonResponse(j, 200);
  } catch (e) {
    console.error("vin-decoder-proxy: upstream fetch failed:", (e as Error)?.name ?? "error");
    return jsonResponse({ error: "upstream_unreachable" }, 502);
  }
});

// NHTSA vPIC flat decode (DecodeVinValues → Results[0]). Free, no API key.
// Returns null on any failure so enrichment is strictly best-effort.
interface NhtsaValues {
  Make?: string; Model?: string; Series?: string; Trim?: string;
  TransmissionStyle?: string; DriveType?: string; FuelTypePrimary?: string;
  BodyClass?: string; DisplacementL?: string; EngineCylinders?: string; ModelYear?: string;
}
async function fetchNhtsa(vin: string): Promise<NhtsaValues | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (!r.ok) return null;
    const data = await r.json();
    return (data?.Results?.[0] as NhtsaValues) ?? null;
  } catch {
    return null;
  }
}
