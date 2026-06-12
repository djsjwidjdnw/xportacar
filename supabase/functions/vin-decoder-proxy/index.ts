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
//   4. Vincario (vindecoder.eu) — PAID last resort. Runs ONLY when steps 1-3
//      left a REQUIRED field empty (cost control), is cached (vin_decode_cache,
//      90 days) so we never pay twice, and every billable call is usage-logged
//      (vincario_usage_log). Enabled when VINCARIO_API_KEY + VINCARIO_SECRET_KEY
//      are set; if absent or it errors, the request still returns the free data.
//
// ── HOW TO ADD A NEW FREE SOURCE (≈30 min, no refactor) ─────────────────────
//   1. Write an object implementing VinSource: { name, decode(vin) →
//      Promise<Partial<DecodedVehicle> | null> }. Map the upstream fields to
//      the DecodedVehicle keys below. Return null on any failure (best-effort).
//   2. Add it to the SOURCES array in priority order.
//   3. Put its key (if any) in Deno.env and gate it behind an `enabled` flag.
// (A paid source that needs metering belongs in the Vincario-style gated stage
// in the handler, not the free SOURCES loop. auto.dev Growth /build remains a
// disabled stub — 402 on the Starter plan.)
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getUserId } from "../_shared/auth.ts";
import { rateLimited } from "../_shared/rateLimit.ts";

const AUTODEV_KEY = Deno.env.get("AUTODEV_API_KEY") ?? "";
const VINCARIO_API_KEY = Deno.env.get("VINCARIO_API_KEY") ?? "";
const VINCARIO_SECRET_KEY = Deno.env.get("VINCARIO_SECRET_KEY") ?? "";
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
const SOURCES: VinSource[] = [
  autodevSource,
  nhtsaValuesSource,
  nhtsaExtendedSource,
  autodevBuildSource,   // disabled (auto.dev Growth)
  // Vincario (vindecoder.eu) is PAID and handled separately below — it runs
  // last, ONLY when the free sources leave required fields empty, and is
  // cached + usage-logged. It is intentionally NOT in this free cascade loop.
];

const FIELDS: (keyof DecodedVehicle)[] = [
  "make", "model", "trim", "year", "body", "engine", "drive", "transmission", "fuel", "displacement", "cylinders",
];

// The fields that justify spending a paid Vincario credit when still missing.
const REQUIRED: (keyof DecodedVehicle)[] = ["model", "trim", "transmission", "drive", "fuel", "body", "engine"];
const allRequiredFieldsFilled = (m: DecodedVehicle) => REQUIRED.every((f) => !!m[f]);

// Fill ONLY empty fields — never overwrite data a free source already returned
// (Vincario's formatting can differ; trust the earlier source).
function mergeFrom(target: DecodedVehicle, src: Partial<DecodedVehicle>, contributed: Record<string, string[]>, name: string) {
  for (const f of FIELDS) {
    if (!target[f] && src[f]) { target[f] = src[f]; (contributed[name] ??= []).push(f); }
  }
}

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vincario / vindecoder.eu 3.2 decode. Auth = first 10 chars of
// sha1("<VIN>|decode|<API_KEY>|<SECRET_KEY>"). Returns a Partial<DecodedVehicle>
// or null; throws on a credit/auth error so the caller can log it honestly.
async function decodeVincario(vin: string): Promise<Partial<DecodedVehicle> | null> {
  const control = (await sha1Hex(`${vin}|decode|${VINCARIO_API_KEY}|${VINCARIO_SECRET_KEY}`)).substring(0, 10);
  const url = `https://api.vindecoder.eu/3.2/${VINCARIO_API_KEY}/${control}/decode/${vin}.json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let j: { decode?: { label: string; value: unknown }[]; message?: unknown; error?: unknown };
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    j = await r.json();
  } finally {
    clearTimeout(timer);
  }
  if (!j || !Array.isArray(j.decode)) {
    const msg = j?.message ?? j?.error ?? "unexpected response";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  const m: Record<string, string> = {};
  for (const it of j.decode) if (it?.label) m[it.label] = str(it.value) ?? "";

  // Vincario returns ambiguous models as a comma list ("911, 911 Carrera, …");
  // take the first as the canonical model.
  const model = str(m["Model"])?.split(",")[0]?.trim();
  const ccm = Number(m["Engine Displacement (ccm)"]);
  const dispL = Number.isFinite(ccm) && ccm > 0 ? `${(ccm / 1000).toFixed(1)}L` : undefined;
  const cyl = str(m["Engine Cylinders"]);
  const engine = str(m["Engine"]) ?? (dispL || cyl ? [dispL, cyl ? `${cyl}-cyl` : ""].filter(Boolean).join(" ") : undefined);

  return {
    make: str(m["Make"]),
    model,
    trim: str(m["Trim"]) ?? str(m["Series"]) ?? str(m["Version"]),
    year: str(m["Model Year"]),
    body: str(m["Body"]),
    drive: str(m["Drive"]),
    transmission: str(m["Transmission"]),
    fuel: str(m["Fuel Type - Primary"]),
    displacement: dispL,
    cylinders: cyl,
    engine,
  };
}

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

  // ── Paid last-resort: Vincario — ONLY when free sources left required fields
  // empty, and only after a cache check (we never pay twice for the same VIN
  // within 90 days). Every billable call is usage-logged. Failures are swallowed
  // so the request still returns whatever the free sources provided.
  if (VINCARIO_API_KEY && VINCARIO_SECRET_KEY && !allRequiredFieldsFilled(merged)) {
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Cache check — reuse a recent Vincario decode instead of paying again.
    let vinc: Partial<DecodedVehicle> | null = null;
    try {
      const { data: cached } = await db
        .from("vin_decode_cache")
        .select("decoded")
        .eq("vin", vin)
        .gte("created_at", ninetyDaysAgo)
        .maybeSingle();
      if (cached?.decoded) {
        vinc = cached.decoded as Partial<DecodedVehicle>;
        console.log(`[vin-decoder-proxy] vincario CACHE HIT vin=${vin}`);
      }
    } catch (e) {
      console.error(`[vin-decoder-proxy] cache read failed: ${(e as Error)?.message}`);
    }

    if (!vinc) {
      try {
        vinc = await decodeVincario(vin);
        if (vinc) {
          const filled = FIELDS.filter((f) => vinc![f]);
          console.log(`[vin-decoder-proxy] VINCARIO CALL vin=${vin} fields_filled=${filled.join(",") || "none"}`);
          // Persist cache + usage log (best-effort; never block the response).
          await db.from("vin_decode_cache").upsert({ vin, decoded: vinc, source: "vincario", created_at: new Date().toISOString() }).then(
            () => {}, (e: unknown) => console.error(`[vin-decoder-proxy] cache write failed: ${(e as Error)?.message}`),
          );
          await db.from("vincario_usage_log").insert({ vin, fields_returned: vinc }).then(
            () => {}, (e: unknown) => console.error(`[vin-decoder-proxy] usage log failed: ${(e as Error)?.message}`),
          );
        }
      } catch (e) {
        // Honest error handling — log + fall through with the free-source data.
        console.error(`[vin-decoder-proxy] Vincario error: ${(e as Error)?.message}`);
      }
    }

    if (vinc) mergeFrom(merged, vinc, contributed, "vincario");
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
