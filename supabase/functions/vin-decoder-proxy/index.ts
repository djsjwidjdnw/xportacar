// vin-decoder-proxy — server-side VIN decode with a pluggable FREE-source
// cascade. The auto.dev API key lives ONLY here (Deno.env AUTODEV_API_KEY).
// Called by the inspector app via supabase.functions.invoke("vin-decoder-proxy",
// { body: { vin } }). Auth + CORS + rate limiting. Key never returned/logged.
//
// ─────────────────────────────────────────────────────────────────────────
// SOURCE CASCADE (priority order). Each source implements VinSource and returns
// only the fields IT knows; the cascade fills each empty field from the next
// source. Order matters: richer / more-trusted sources first.
//   1. auto.dev /vin        — primary (US + some Europe). Paid key (Starter).
//   2. NHTSA DecodeVinValues — free, no key. Strong for US VINs.
//   3. NHTSA DecodeVinExtended — free fallback (same dataset as Values in
//      practice; used only if Values yielded nothing, for robustness).
//
// ── HOW TO ADD A NEW SOURCE (≈30 min, no refactor) ──────────────────────────
//   1. Write an object implementing VinSource: { name, decode(vin) →
//      Promise<Partial<DecodedVehicle> | null> }. Map the upstream fields to
//      the DecodedVehicle keys below. Return null on any failure (best-effort).
//   2. Add it to the SOURCES array in priority order.
//   3. Put its key (if any) in Deno.env and gate it behind an `enabled` flag.
// Paid sources are stubbed + DISABLED below (auto.dev Growth /build, which is
// 402 on the Starter plan, and vindecoder.eu). Flip `enabled` + set the env
// when a plan is purchased — nothing else changes.
// ─────────────────────────────────────────────────────────────────────────

import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { rateLimited } from "../_shared/rateLimit.ts";

const AUTODEV_KEY = Deno.env.get("AUTODEV_API_KEY") ?? "";
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i; // ISO 3779: 17 chars, excludes I,O,Q.

// Canonical decoded shape every source maps into.
interface DecodedVehicle {
  make?: string; model?: string; trim?: string; year?: string;
  body?: string; engine?: string; drive?: string; transmission?: string;
  fuel?: string; displacement?: string; cylinders?: string;
}

interface VinSource {
  name: string;
  enabled: boolean;
  decode(vin: string): Promise<Partial<DecodedVehicle> | null>;
}

const str = (v: unknown): string | undefined => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : undefined;
};

async function getJson(url: string, init?: RequestInit, ms = 7000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// ── Source 1: auto.dev /vin ────────────────────────────────────────────────
const autodevSource: VinSource = {
  name: "autodev",
  enabled: !!AUTODEV_KEY,
  async decode(vin) {
    // deno-lint-ignore no-explicit-any
    const j = (await getJson(
      `https://api.auto.dev/vin/${encodeURIComponent(vin)}?apikey=${encodeURIComponent(AUTODEV_KEY)}`,
      { headers: { Authorization: `Bearer ${AUTODEV_KEY}`, Accept: "application/json" } },
    )) as any;
    if (!j || j.vinValid === false || j.error) return null;
    const nested = j.vehicle ?? {};
    return {
      make: str(j.make) ?? str(nested.make) ?? str(nested.manufacturer),
      model: str(j.model) ?? str(nested.model),
      trim: str(j.trim),
      year: str(nested.year) ?? str(Array.isArray(j.years) ? j.years[0] : j.year),
      body: str(j.body) ?? str(j.bodyClass) ?? str(j.style),
      engine: str(j.engine) ?? str(j.engineDescription),
      drive: str(j.drive) ?? str(j.drivetrain),
      transmission: str(j.transmission) ?? str(j.transmissionStyle),
      fuel: str(j.fuel) ?? str(j.fuelType),
      displacement: str(j.displacement) ?? str(j.displacementL),
      cylinders: str(j.cylinders),
    };
  },
};

// ── NHTSA shared mapper ────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
function mapNhtsa(r: any): Partial<DecodedVehicle> | null {
  if (!r) return null;
  return {
    make: str(r.Make), model: str(r.Model),
    trim: str(r.Trim) ?? str(r.Series),
    year: str(r.ModelYear),
    body: str(r.BodyClass),
    drive: str(r.DriveType),
    transmission: str(r.TransmissionStyle),
    fuel: str(r.FuelTypePrimary),
    displacement: str(r.DisplacementL),
    cylinders: str(r.EngineCylinders),
  };
}

// ── Source 2: NHTSA DecodeVinValues (free) ─────────────────────────────────
const nhtsaValuesSource: VinSource = {
  name: "nhtsa_values",
  enabled: true,
  async decode(vin) {
    // deno-lint-ignore no-explicit-any
    const j = (await getJson(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`)) as any;
    return mapNhtsa(j?.Results?.[0]);
  },
};

// ── Source 3: NHTSA DecodeVinExtended (free; robustness fallback) ───────────
// Same dataset as Values in practice — kept as a second NHTSA attempt only.
const nhtsaExtendedSource: VinSource = {
  name: "nhtsa_extended",
  enabled: true,
  async decode(vin) {
    // deno-lint-ignore no-explicit-any
    const j = (await getJson(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinExtended/${encodeURIComponent(vin)}?format=json`)) as any;
    const arr = j?.Results;
    if (!Array.isArray(arr)) return null;
    // Extended returns [{Variable,Value}] — flatten to a values-style object.
    // deno-lint-ignore no-explicit-any
    const flat: Record<string, string> = {};
    for (const it of arr) if (it?.Variable) flat[String(it.Variable).replace(/\s+/g, "")] = it.Value;
    return mapNhtsa({
      Make: flat.Make, Model: flat.Model, Trim: flat.Trim, Series: flat.Series,
      ModelYear: flat.ModelYear, BodyClass: flat.BodyClass, DriveType: flat.DriveType,
      TransmissionStyle: flat.TransmissionStyle, FuelTypePrimary: flat.FuelTypePrimary,
      DisplacementL: flat.DisplacementL, EngineCylinders: flat.EngineCylinders,
    });
  },
};

// ── DISABLED paid stubs (flip `enabled` + set env when a plan is bought) ────
// auto.dev Growth /build (OEM build data — richer EU trims). 402 on Starter.
const autodevBuildSource: VinSource = {
  name: "autodev_build",
  enabled: false, // requires auto.dev Growth plan ($299/mo)
  async decode(_vin) { return null; },
};
// vindecoder.eu (best for European VINs; paid API key).
const vindecoderEuSource: VinSource = {
  name: "vindecoder_eu",
  enabled: false, // requires VINDECODER_EU_KEY + paid credits
  async decode(_vin) { return null; },
};

const SOURCES: VinSource[] = [
  autodevSource,
  nhtsaValuesSource,
  nhtsaExtendedSource,
  autodevBuildSource,   // disabled
  vindecoderEuSource,   // disabled
];

const FIELDS: (keyof DecodedVehicle)[] = [
  "make", "model", "trim", "year", "body", "engine", "drive", "transmission", "fuel", "displacement", "cylinders",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const userId = await getUserId(req);
  if (!userId) return jsonResponse({ error: "unauthorized" }, 401);
  if (rateLimited(`vin:${userId}`)) {
    return jsonResponse({ error: "rate_limited", message: "Too many requests, slow down." }, 429);
  }

  let body: { vin?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const vin = String(body.vin ?? "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) return jsonResponse({ error: "invalid_vin", message: "VIN must be exactly 17 characters" }, 400);

  // Run the cascade: each enabled source fills only the still-empty fields.
  const merged: DecodedVehicle = {};
  const contributed: Record<string, string[]> = {};
  for (const src of SOURCES) {
    if (!src.enabled) continue;
    if (FIELDS.every((f) => merged[f])) break; // everything filled — stop early
    const got = await src.decode(vin).catch(() => null);
    if (!got) continue;
    for (const f of FIELDS) {
      if (!merged[f] && got[f]) { merged[f] = got[f]; (contributed[src.name] ??= []).push(f); }
    }
  }

  if (!merged.make && !merged.model && !merged.year) {
    console.log(`[vin-decoder-proxy] vin=${vin} → no_data`);
    return jsonResponse({ vinValid: false, error: "not_found" }, 404);
  }

  // Return in the auto.dev-compatible shape the mobile parser already reads
  // (flat keys + nested vehicle.year), so no client change is required.
  const out = {
    vin,
    vinValid: true,
    make: merged.make ?? "",
    model: merged.model ?? "",
    trim: merged.trim ?? "",
    body: merged.body ?? "",
    engine: merged.engine ?? "",
    drive: merged.drive ?? "",
    transmission: merged.transmission ?? "",
    fuel: merged.fuel ?? "",
    displacement: merged.displacement ?? "",
    cylinders: merged.cylinders ?? "",
    vehicle: { year: merged.year ? Number(merged.year) || merged.year : undefined, make: merged.make, model: merged.model },
    sources: contributed, // which source filled what (debug aid; harmless)
  };
  console.log(`[vin-decoder-proxy] vin=${vin} sources=${JSON.stringify(contributed)} ` +
    `present={trim:${!!merged.trim},transmission:${!!merged.transmission},drive:${!!merged.drive},fuel:${!!merged.fuel},body:${!!merged.body}}`);
  return jsonResponse(out, 200);
});
