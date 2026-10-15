// Market price engine — the pure part. Shared by the market-prices Edge
// Function and its Node unit tests (scripts/test-market-prices.ts), so it uses
// no Deno APIs and makes no network calls: callers pass parsed JSON in and get
// plain values out.
//
// UAE side: Dubizzle Motors listings for the same make and model, year within
// +/- 1, from an Apify actor (app_settings.market_prices_apify_actor). The
// median of the comparables after dropping obvious outliers, in AED; at least
// MIN_UAE_COMPARABLES or "not enough UAE data".
// EU side: Vincario "vehicle market value" for the VIN, europe group median and
// listing count, in EUR.
// FX: the ECB publishes no AED rate, so EUR per AED comes from the day's ECB
// EUR/USD reference rate and the AED/USD peg (3.6725).

export type SideStatus = "ok" | "insufficient_data" | "error";

export const MIN_UAE_COMPARABLES = 3;
export const REUSE_DAYS = 7;
export const AED_PER_USD = 3.6725;
// Listings below this are instalment or "call for price" placeholders, not car prices.
export const MIN_UAE_PRICE_AED = 5_000;
export const MAX_UAE_PRICE_AED = 50_000_000;

// Cost model (estimates, logged per lookup). memo23 actor, pay per event as
// listed on 2026-10-15: $0.00095 per result + $0.005 per run start (512 MB).
export const APIFY_MAX_ITEMS = 50;
export const APIFY_PRICE_PER_RESULT_USD = 0.00095;
export const APIFY_START_FEE_USD = 0.005;
// Hard cap passed to Apify for every run (maxTotalChargeUsd).
export const APIFY_MAX_CHARGE_USD = 0.1;
export const APIFY_RUN_TIMEOUT_SECS = 100;
// Vincario Vehicle Market Value, 100-lookup pack price. Not charged when the
// market has fewer than 10 similar vehicles ("Insufficient statistical data").
export const VINCARIO_COST_EUR = 1.99;

export const VINCARIO_ENDPOINT = "vehicle-market-value";
export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

// ---------------------------------------------------------------------------
// Vincario (EU)
// ---------------------------------------------------------------------------

export interface EuResult {
  status: SideStatus;
  medianEur: number | null;
  count: number | null;
  error: string | null;
  /** Whether Vincario bills this response (a 200 with market data). */
  charged: boolean;
}

/** First 10 hex chars of sha1("VIN|vehicle-market-value|API key|secret key"), VIN upper-cased. */
export async function vincarioControlSum(vin: string, apiKey: string, secretKey: string): Promise<string> {
  const data = new TextEncoder().encode(`${vin.toUpperCase()}|${VINCARIO_ENDPOINT}|${apiKey}|${secretKey}`);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

/** The request URL. It contains the API key: never log it. */
export function vincarioMarketValueUrl(vin: string, apiKey: string, controlSum: string): string {
  return `https://api.vincario.com/3.2/${encodeURIComponent(apiKey)}/${controlSum}/${VINCARIO_ENDPOINT}/${encodeURIComponent(vin.toUpperCase())}.json`;
}

export function parseVincarioMarketValue(body: unknown, httpStatus = 200): EuResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const fail = (status: SideStatus, error: string, charged = false): EuResult =>
    ({ status, medianEur: null, count: null, error, charged });

  if (b.error === true || typeof b.error === "string" || httpStatus >= 400) {
    const msg = String(b.message ?? (typeof b.error === "string" ? b.error : "")).toLowerCase();
    if (msg.includes("insufficient statistical data")) return fail("insufficient_data", "vincario_insufficient_data");
    if (msg.includes("unknown api key") || msg.includes("invalid control sum")) return fail("error", "vincario_auth_failed");
    if (msg.includes("not enough lookups")) return fail("error", "vincario_out_of_lookups");
    if (msg.includes("requests per minute")) return fail("error", "vincario_rate_limited");
    if (msg.includes("not recognized")) return fail("error", "vincario_vin_not_recognized");
    return fail("error", httpStatus >= 400 ? `vincario_http_${httpStatus}` : "vincario_error");
  }

  const marketPrice = (b.market_price && typeof b.market_price === "object" ? b.market_price : {}) as Record<string, unknown>;
  const europe = marketPrice.europe as Record<string, unknown> | undefined;
  if (!europe || typeof europe !== "object") return fail("insufficient_data", "vincario_no_europe_group", true);
  if (String(europe.price_currency ?? "EUR").toUpperCase() !== "EUR") return fail("error", "vincario_unexpected_currency", true);

  const median = Number(europe.price_median);
  const count = Number(europe.price_count);
  if (!Number.isFinite(median) || median <= 0 || !Number.isFinite(count) || count <= 0) {
    return { status: "insufficient_data", medianEur: null, count: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0, error: "vincario_no_europe_median", charged: true };
  }
  return { status: "ok", medianEur: round(median, 2), count: Math.round(count), error: null, charged: true };
}

// ---------------------------------------------------------------------------
// Apify / Dubizzle Motors (UAE)
// ---------------------------------------------------------------------------

/** Dubizzle URL segment: "Mercedes-Benz" -> "mercedes-benz", "Range Rover Sport" -> "range-rover-sport". */
export function dubizzleSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Dubizzle Motors search for the same make and model, year within +/- 1. */
export function dubizzleSearchUrl(make: string, model: string, year: number): string {
  const qs = new URLSearchParams({ year__gte: String(year - 1), year__lte: String(year + 1) });
  return `https://dubai.dubizzle.com/motors/used-cars/${dubizzleSlug(make)}/${dubizzleSlug(model)}/?${qs.toString()}`;
}

const ACTOR_RE = /^[A-Za-z0-9_.-]+([/~][A-Za-z0-9_.-]+)?$/;

/** "memo23/dubizzle-search-listing-s-scraper" -> "memo23~dubizzle-search-listing-s-scraper" (actor ids pass through). */
export function apifyActorPath(actor: string): string | null {
  const a = actor.trim();
  return ACTOR_RE.test(a) ? a.replace("/", "~") : null;
}

export function apifyRunInput(searchUrl: string): Record<string, unknown> {
  return { startUrls: [searchUrl], maxItems: APIFY_MAX_ITEMS, monitoringMode: false, enrichEmails: false };
}

/** Run the actor and return its dataset items, capped in items, time and spend. The token goes in a header, never the URL. */
export function apifyRunUrl(actorPath: string): string {
  const qs = new URLSearchParams({
    timeout: String(APIFY_RUN_TIMEOUT_SECS),
    memory: "512",
    maxItems: String(APIFY_MAX_ITEMS),
    maxTotalChargeUsd: String(APIFY_MAX_CHARGE_USD),
    format: "json",
    clean: "true",
  });
  return `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?${qs.toString()}`;
}

export function apifyCostUsd(items: number): number {
  return round(APIFY_START_FEE_USD + Math.max(0, items) * APIFY_PRICE_PER_RESULT_USD, 4);
}

export interface Comparable {
  id: string | null;
  priceAed: number;
  year: number | null;
  km: number | null;
  make: string | null;
  model: string | null;
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const toStr = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});

function detailValue(item: Rec, slug: string): unknown {
  const details = rec(rec(item.listing).details);
  for (const group of ["primary", "secondary"]) {
    const list = details[group];
    if (!Array.isArray(list)) continue;
    for (const d of list) if (rec(d).slug === slug) return rec(d).value;
  }
  return undefined;
}

/**
 * One Dubizzle listing -> a comparable. Reads the memo23 actor's nested shape
 * (listing / ad_ops / basicInfo) and falls back to flat fields, so a swapped
 * actor that returns price, year, kilometers, make and model still works.
 * Returns null for a non-AED or price-less listing.
 */
export function toComparable(raw: unknown): Comparable | null {
  const item = rec(raw);
  const listing = rec(item.listing);
  const ad = rec(item.ad_ops);
  const listingPrice = rec(listing.price);
  const flatPrice = item.price;
  const flatPriceRec = flatPrice && typeof flatPrice === "object" ? rec(flatPrice) : {};

  const currency = String(listingPrice.currency ?? flatPriceRec.currency ?? item.currency ?? "AED").toUpperCase();
  if (currency !== "AED") return null;

  const priceAed =
    toNum(listingPrice.raw) ??
    toNum(rec(item.basicInfo).price) ??
    toNum(ad.price_aed) ??
    (flatPrice && typeof flatPrice === "object" ? toNum(rec(flatPrice).raw ?? rec(flatPrice).value) : toNum(flatPrice));
  if (priceAed == null) return null;

  const year = toNum(ad.year) ?? toNum(detailValue(item, "year")) ?? toNum(item.year);
  const km = toNum(detailValue(item, "kilometers")) ?? toNum(item.kilometers) ?? toNum(item.mileage);
  return {
    id: toStr(listing.listing_id) ?? toStr(item.listing_id) ?? toStr(listing.absolute_url) ?? toStr(item.url) ?? toStr(item.id),
    priceAed,
    year: year == null ? null : Math.round(year),
    km,
    make: toStr(ad.make) ?? toStr(ad.auto_make_name) ?? toStr(item.make),
    model: toStr(ad.model) ?? toStr(item.model),
  };
}

const squash = (s: string) => dubizzleSlug(s).replace(/-/g, "");
const sameMake = (a: string, b: string) => squash(a) === squash(b);
// "GLE" matches "GLE-Class" and "GLC 43 AMG" matches "GLC" (the search URL already pins the model).
const sameModel = (a: string, b: string) => {
  const x = squash(a), y = squash(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
};

export interface Target { make: string; model: string; year: number }

/** Keep listings with an AED price in range, the same make and model and a year within +/- 1; drop duplicates. */
export function selectComparables(items: unknown[], target: Target): { kept: Comparable[]; rejected: number } {
  const seen = new Set<string>();
  const kept: Comparable[] = [];
  let rejected = 0;
  for (const raw of items) {
    const c = toComparable(raw);
    const reject =
      !c ||
      (c.id != null && seen.has(c.id)) ||
      c.year == null || Math.abs(c.year - target.year) > 1 ||
      (c.make != null && !sameMake(c.make, target.make)) ||
      (c.model != null && !sameModel(c.model, target.model)) ||
      c.priceAed < MIN_UAE_PRICE_AED || c.priceAed > MAX_UAE_PRICE_AED;
    if (reject) { rejected++; continue; }
    if (c!.id != null) seen.add(c!.id);
    kept.push(c!);
  }
  return { kept, rejected };
}

/** Linear-interpolation quantile of a sorted array. */
export function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}

/**
 * Drop obvious outliers: anything below 0.4x or above 2.5x the raw median
 * (typos, instalment prices, a different model), then, with 4 or more left,
 * anything outside the 1.5 x IQR fences. The IQR is floored at 20% of the
 * median so near-identical prices do not throw out normal variation (mileage,
 * trim and spec move used-car prices by tens of percent).
 */
export function dropOutliers(prices: number[]): { kept: number[]; dropped: number[] } {
  const sorted = [...prices].sort((a, b) => a - b);
  if (!sorted.length) return { kept: [], dropped: [] };
  const m = quantile(sorted, 0.5);
  let kept = sorted.filter((p) => p >= 0.4 * m && p <= 2.5 * m);
  if (kept.length >= 4) {
    const q1 = quantile(kept, 0.25);
    const q3 = quantile(kept, 0.75);
    const iqr = Math.max(q3 - q1, 0.2 * quantile(kept, 0.5));
    kept = kept.filter((p) => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
  }
  const dropped: number[] = [];
  const left = [...kept];
  for (const p of sorted) {
    const i = left.indexOf(p);
    if (i === -1) dropped.push(p); else left.splice(i, 1);
  }
  return { kept, dropped };
}

export interface UaeResult {
  status: SideStatus;
  medianAed: number | null;
  /** Comparables the median is based on (after outliers were dropped). */
  count: number;
  /** Listings that matched make, model and year before the outlier step. */
  matched: number;
  outliers: number;
  error: string | null;
}

export function summarizeUae(items: unknown[], target: Target): UaeResult {
  const { kept } = selectComparables(items, target);
  const prices = kept.map((c) => c.priceAed);
  const { kept: clean, dropped } = dropOutliers(prices);
  if (clean.length < MIN_UAE_COMPARABLES) {
    return { status: "insufficient_data", medianAed: null, count: clean.length, matched: prices.length, outliers: dropped.length, error: "not_enough_uae_data" };
  }
  return { status: "ok", medianAed: round(median(clean)!, 2), count: clean.length, matched: prices.length, outliers: dropped.length, error: null };
}

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

export const FX_URLS = [
  "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD",
  "https://api.frankfurter.app/latest?from=EUR&to=USD",
];

/** Frankfurter (ECB) EUR->USD response -> the rate and its ECB reference date. */
export function parseFrankfurter(body: unknown): { usdPerEur: number; ecbDate: string } | null {
  const b = rec(body);
  if (String(b.base ?? "EUR").toUpperCase() !== "EUR") return null;
  const usd = Number(rec(b.rates).USD);
  const date = String(b.date ?? "");
  if (!Number.isFinite(usd) || usd < 0.5 || usd > 3 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { usdPerEur: usd, ecbDate: date };
}

/** EUR per 1 AED from the ECB EUR/USD rate and the AED/USD peg. */
export function eurPerAed(usdPerEur: number, aedPerUsd = AED_PER_USD): number {
  return 1 / (usdPerEur * aedPerUsd);
}

export function aedToEur(aed: number, rateEurPerAed: number): number {
  return round(aed * rateEurPerAed, 2);
}

// ---------------------------------------------------------------------------
// Reuse
// ---------------------------------------------------------------------------

/** A side is reused when it has a definite answer (ok or not enough data) under REUSE_DAYS old. Errors are retried. */
export function sideIsFresh(status: string | null | undefined, fetchedAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (status !== "ok" && status !== "insufficient_data") return false;
  if (!fetchedAt) return false;
  const t = fetchedAt instanceof Date ? fetchedAt.getTime() : Date.parse(fetchedAt);
  return Number.isFinite(t) && now - t < REUSE_DAYS * 86_400_000;
}

/** Map a thrown fetch error to a short code. Never echo the error text: Deno puts the URL (with the Vincario key) in it. */
export function fetchErrorCode(prefix: string, e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? "";
  return name === "TimeoutError" || name === "AbortError" ? `${prefix}_timeout` : `${prefix}_network_error`;
}

// ---------------------------------------------------------------------------
// Runner. The Edge Function wires real dependencies (Postgres, Vault, fetch);
// the unit tests wire fakes and a fetch spy, which is how dormancy is proven:
// with the flag off or a key missing, prepareLookup() returns before any
// dependency that reaches the network is touched.
// ---------------------------------------------------------------------------

export const VINCARIO_TIMEOUT_MS = 15_000;
export const APIFY_TIMEOUT_MS = 115_000;
export const FX_TIMEOUT_MS = 8_000;

export type Trigger = "publish" | "relist" | "refresh" | "test";
export type Side = "eu" | "uae";
export type Service = "vincario" | "apify" | "fx";

export const KEY_NAMES = ["market_vincario_api_key", "market_vincario_secret_key", "market_apify_token"] as const;
export type KeyName = (typeof KEY_NAMES)[number];

export interface EngineSettings { enabled: boolean; actor: string | null }
export type EngineKeys = Record<KeyName, string | null>;

export interface VehicleInput {
  id: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
}

export interface PriceRow {
  vehicle_id: string;
  uae_median_aed: number | null;
  uae_median_eur: number | null;
  uae_count: number | null;
  uae_status: SideStatus | null;
  uae_error: string | null;
  uae_source: string | null;
  uae_fetched_at: string | null;
  eu_median_eur: number | null;
  eu_count: number | null;
  eu_status: SideStatus | null;
  eu_error: string | null;
  eu_fetched_at: string | null;
  fx_rate: number | null;
  fx_date: string | null;
}

export interface LookupLog {
  vehicle_id: string | null;
  service: Service;
  triggered_by: Trigger;
  success: boolean;
  records: number | null;
  est_cost: number;
  cost_currency: "EUR" | "USD";
  error: string | null;
  duration_ms: number;
}

export interface FxRate { eurPerAed: number; ecbDate: string }
export interface FxRow { fetched_on: string; ecb_date: string; usd_per_eur: number; aed_per_usd: number; eur_per_aed: number; source: string }

export interface EngineDeps {
  settings(): Promise<EngineSettings>;
  keys(): Promise<EngineKeys>;
  vehicle(id: string): Promise<VehicleInput | null>;
  priceRow(id: string): Promise<PriceRow | null>;
  /** Mark a lookup as running; false when another one started under 3 minutes ago. */
  claim(id: string): Promise<boolean>;
  /** Write the fetched sides and clear the running marker. */
  save(id: string, patch: Partial<PriceRow>): Promise<void>;
  release(id: string): Promise<void>;
  /** Today's cached rate, or null. */
  fxToday(): Promise<FxRate | null>;
  /** The newest cached rate under 7 days old (fallback when today's fetch fails). */
  fxRecent(): Promise<FxRate | null>;
  saveFx(row: FxRow): Promise<void>;
  log(rows: LookupLog[]): Promise<void>;
  fetch: typeof fetch;
  now(): number;
  info(line: string): void;
}

export interface LookupRequest {
  vehicleId: string;
  trigger: Trigger;
  force?: boolean;
  sides?: Side[];
}

export interface SideSummary { status: SideStatus; median: number | null; count: number | null; error: string | null }

export type LookupOutcome =
  | { status: "dormant"; reason: "disabled" | "keys_missing"; missing?: KeyName[] }
  | { status: "not_found" }
  | { status: "cached" }
  | { status: "in_progress" }
  | { status: "done"; sides: Side[]; eu: SideSummary | null; uae: (SideSummary & { medianEur: number | null }) | null };

export interface LookupJob {
  vehicle: VehicleInput;
  sides: Side[];
  trigger: Trigger;
  keys: EngineKeys;
  actor: string | null;
  previous: PriceRow | null;
}

/** Decide whether anything should be fetched. Nothing here touches the network. */
export async function prepareLookup(deps: EngineDeps, req: LookupRequest): Promise<{ outcome: LookupOutcome } | { job: LookupJob }> {
  const settings = await deps.settings();
  if (!settings.enabled) {
    deps.info(`[market-prices] dormant: market_prices_enabled is off; no lookup for vehicle ${req.vehicleId} (${req.trigger})`);
    return { outcome: { status: "dormant", reason: "disabled" } };
  }
  const keys = await deps.keys();
  const missing = KEY_NAMES.filter((k) => !keys[k]);
  if (missing.length) {
    deps.info(`[market-prices] dormant: key missing (${missing.join(", ")}); no lookup for vehicle ${req.vehicleId} (${req.trigger})`);
    return { outcome: { status: "dormant", reason: "keys_missing", missing } };
  }

  const vehicle = await deps.vehicle(req.vehicleId);
  if (!vehicle) return { outcome: { status: "not_found" } };

  const previous = await deps.priceRow(req.vehicleId);
  const now = deps.now();
  const wanted: Side[] = req.sides?.length ? req.sides : ["eu", "uae"];
  const sides = wanted.filter((s) =>
    req.force ||
    !sideIsFresh(s === "eu" ? previous?.eu_status : previous?.uae_status, s === "eu" ? previous?.eu_fetched_at : previous?.uae_fetched_at, now));
  if (!sides.length) {
    deps.info(`[market-prices] reuse: vehicle ${req.vehicleId} was priced under ${REUSE_DAYS} days ago (${req.trigger})`);
    return { outcome: { status: "cached" } };
  }
  if (!(await deps.claim(req.vehicleId))) return { outcome: { status: "in_progress" } };
  return { job: { vehicle, sides, trigger: req.trigger, keys, actor: settings.actor, previous } };
}

const elapsed = (deps: EngineDeps, start: number) => Math.max(0, Math.round(deps.now() - start));

async function readJson(res: Response): Promise<unknown> {
  try { return await res.json(); } catch { return undefined; }
}

async function lookupEu(deps: EngineDeps, job: LookupJob): Promise<{ result: EuResult; log: LookupLog | null }> {
  const vin = (job.vehicle.vin ?? "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) {
    return { result: { status: "error", medianEur: null, count: null, error: "no_valid_vin", charged: false }, log: null };
  }
  const start = deps.now();
  let result: EuResult;
  try {
    const controlSum = await vincarioControlSum(vin, job.keys.market_vincario_api_key!, job.keys.market_vincario_secret_key!);
    const res = await deps.fetch(vincarioMarketValueUrl(vin, job.keys.market_vincario_api_key!, controlSum), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(VINCARIO_TIMEOUT_MS),
    });
    const body = await readJson(res);
    result = body === undefined
      ? { status: "error", medianEur: null, count: null, error: res.ok ? "vincario_bad_json" : `vincario_http_${res.status}`, charged: false }
      : parseVincarioMarketValue(body, res.status);
  } catch (e) {
    result = { status: "error", medianEur: null, count: null, error: fetchErrorCode("vincario", e), charged: false };
  }
  return {
    result,
    log: {
      vehicle_id: job.vehicle.id, service: "vincario", triggered_by: job.trigger,
      success: result.status !== "error", records: result.count,
      est_cost: result.charged ? VINCARIO_COST_EUR : 0, cost_currency: "EUR",
      error: result.error, duration_ms: elapsed(deps, start),
    },
  };
}

async function fx(deps: EngineDeps, job: LookupJob, logs: LookupLog[]): Promise<FxRate | null> {
  const cached = await deps.fxToday();
  if (cached) return cached;
  const start = deps.now();
  let error = "fx_unavailable";
  for (const url of FX_URLS) {
    try {
      const res = await deps.fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FX_TIMEOUT_MS) });
      if (!res.ok) { error = `fx_http_${res.status}`; continue; }
      const parsed = parseFrankfurter(await readJson(res));
      if (!parsed) { error = "fx_bad_response"; continue; }
      const rate = eurPerAed(parsed.usdPerEur);
      await deps.saveFx({
        fetched_on: new Date(deps.now()).toISOString().slice(0, 10), ecb_date: parsed.ecbDate,
        usd_per_eur: parsed.usdPerEur, aed_per_usd: AED_PER_USD, eur_per_aed: rate, source: url,
      });
      logs.push({ vehicle_id: job.vehicle.id, service: "fx", triggered_by: job.trigger, success: true, records: 1, est_cost: 0, cost_currency: "EUR", error: null, duration_ms: elapsed(deps, start) });
      return { eurPerAed: rate, ecbDate: parsed.ecbDate };
    } catch (e) {
      error = fetchErrorCode("fx", e);
    }
  }
  logs.push({ vehicle_id: job.vehicle.id, service: "fx", triggered_by: job.trigger, success: false, records: 0, est_cost: 0, cost_currency: "EUR", error, duration_ms: elapsed(deps, start) });
  return await deps.fxRecent();
}

const APIFY_HTTP_ERRORS: Record<number, string> = {
  400: "apify_bad_input", 401: "apify_auth_failed", 402: "apify_payment_required", 403: "apify_forbidden",
  404: "apify_actor_not_found", 408: "apify_run_timeout", 429: "apify_rate_limited",
};

async function lookupUae(deps: EngineDeps, job: LookupJob, logs: LookupLog[]): Promise<{ result: UaeResult; rate: FxRate | null; log: LookupLog | null }> {
  const { make, model, year } = job.vehicle;
  const fail = (error: string): UaeResult => ({ status: "error", medianAed: null, count: 0, matched: 0, outliers: 0, error });
  if (!make || !model || !year) return { result: fail("missing_make_model_year"), rate: null, log: null };
  const actorPath = apifyActorPath(job.actor ?? "");
  if (!actorPath) return { result: fail("apify_actor_invalid"), rate: null, log: null };

  const start = deps.now();
  const run = (async (): Promise<{ result: UaeResult; items: number; costUsd: number }> => {
    try {
      const res = await deps.fetch(apifyRunUrl(actorPath), {
        method: "POST",
        headers: { Authorization: `Bearer ${job.keys.market_apify_token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(apifyRunInput(dubizzleSearchUrl(make, model, year))),
        signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
      });
      if (!res.ok) {
        // A run that timed out may still have billed up to the item cap; an auth or input error billed nothing.
        const cost = res.status === 408 ? apifyCostUsd(APIFY_MAX_ITEMS) : res.status >= 500 ? APIFY_START_FEE_USD : 0;
        return { result: fail(APIFY_HTTP_ERRORS[res.status] ?? `apify_http_${res.status}`), items: 0, costUsd: cost };
      }
      const items = await readJson(res);
      if (!Array.isArray(items)) return { result: fail("apify_bad_response"), items: 0, costUsd: APIFY_START_FEE_USD };
      return { result: summarizeUae(items, { make, model, year }), items: items.length, costUsd: apifyCostUsd(items.length) };
    } catch (e) {
      const code = fetchErrorCode("apify", e);
      return { result: fail(code), items: 0, costUsd: code === "apify_timeout" ? apifyCostUsd(APIFY_MAX_ITEMS) : 0 };
    }
  })();
  const [rate, done] = await Promise.all([fx(deps, job, logs), run]);
  return {
    result: done.result,
    rate,
    log: {
      vehicle_id: job.vehicle.id, service: "apify", triggered_by: job.trigger,
      success: done.result.status !== "error", records: done.items,
      est_cost: done.costUsd, cost_currency: "USD",
      error: done.result.error, duration_ms: elapsed(deps, start),
    },
  };
}

/**
 * Run the external lookups for a claimed job, save and log them. The two sides
 * run in parallel and never block each other. A side that errors keeps the
 * previous good result (with its date) and records the error code.
 */
export async function runLookup(deps: EngineDeps, job: LookupJob): Promise<LookupOutcome> {
  const logs: LookupLog[] = [];
  try {
    const [eu, uae] = await Promise.all([
      job.sides.includes("eu") ? lookupEu(deps, job) : Promise.resolve(null),
      job.sides.includes("uae") ? lookupUae(deps, job, logs) : Promise.resolve(null),
    ]);
    const nowIso = new Date(deps.now()).toISOString();
    const prev = job.previous;
    const patch: Partial<PriceRow> = {};

    let euSummary: SideSummary | null = null;
    if (eu) {
      const r = eu.result;
      if (r.status === "error" && prev?.eu_status === "ok") {
        patch.eu_error = r.error;
      } else {
        Object.assign(patch, { eu_median_eur: r.medianEur, eu_count: r.count, eu_status: r.status, eu_error: r.error, eu_fetched_at: nowIso });
      }
      if (eu.log) logs.push(eu.log);
      euSummary = { status: r.status, median: r.medianEur, count: r.count, error: r.error };
    }

    let uaeSummary: (SideSummary & { medianEur: number | null }) | null = null;
    if (uae) {
      const r = uae.result;
      const medianEur = r.medianAed != null && uae.rate ? aedToEur(r.medianAed, uae.rate.eurPerAed) : null;
      if (r.status === "error" && prev?.uae_status === "ok") {
        patch.uae_error = r.error;
      } else {
        Object.assign(patch, {
          uae_median_aed: r.medianAed, uae_median_eur: medianEur, uae_count: r.count, uae_status: r.status,
          uae_error: r.error, uae_source: job.actor, uae_fetched_at: nowIso,
          fx_rate: uae.rate?.eurPerAed ?? null, fx_date: uae.rate?.ecbDate ?? null,
        });
      }
      if (uae.log) logs.push(uae.log);
      uaeSummary = { status: r.status, median: r.medianAed, count: r.count, error: r.error, medianEur };
    }

    await deps.save(job.vehicle.id, patch);
    if (logs.length) await deps.log(logs);
    for (const l of logs) {
      deps.info(`[market-prices] ${l.service} vehicle=${job.vehicle.id} trigger=${l.triggered_by} success=${l.success} records=${l.records ?? 0} cost=${l.est_cost} ${l.cost_currency}${l.error ? ` error=${l.error}` : ""} ${l.duration_ms}ms`);
    }
    return { status: "done", sides: job.sides, eu: euSummary, uae: uaeSummary };
  } catch (e) {
    await deps.release(job.vehicle.id).catch(() => {});
    throw e;
  }
}
