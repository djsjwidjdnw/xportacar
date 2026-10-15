// Unit tests for the market-prices engine and the "Market prices" card rules,
// against recorded sample responses (scripts/fixtures/market-prices/).
// Run: npx tsx scripts/test-market-prices.ts
//
// Nothing here reaches the network: every fetch goes to a stub that serves a
// fixture and records the call, which is also how dormancy is proven (flag off
// or a key missing -> zero fetch calls).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  AED_PER_USD, APIFY_MAX_CHARGE_USD, APIFY_MAX_ITEMS, KEY_NAMES, VINCARIO_COST_EUR,
  aedToEur, apifyActorPath, apifyCostUsd, apifyRunInput, apifyRunUrl, dropOutliers,
  dubizzleSearchUrl, dubizzleSlug, eurPerAed, median, parseFrankfurter, parseVincarioMarketValue,
  prepareLookup, runLookup, selectComparables, sideIsFresh, summarizeUae, toComparable,
  vincarioControlSum, vincarioMarketValueUrl,
  type EngineDeps, type EngineKeys, type FxRate, type FxRow, type LookupLog, type LookupOutcome,
  type LookupRequest, type PriceRow, type VehicleInput,
} from "../supabase/functions/_shared/marketPrices";
import { marketPricesView, showSpecNote, type MarketPricesRow } from "../src/lib/market-prices-view";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(`scripts/fixtures/market-prices/${name}`, "utf8"));

const VINCARIO_DOCS = fixture("vincario-vehicle-market-value.docs-example.json");
const VINCARIO_ERRORS = fixture("vincario-errors.docs-examples.json") as Record<string, unknown>;
const VINCARIO_GLC = fixture("vincario-vehicle-market-value.glc43-2018.derived.json");
const APIFY_PUBLISHED = fixture("apify-memo23-motors.published-sample.json") as unknown[];
const APIFY_GLC = fixture("apify-memo23-motors.glc43-2018.derived.json") as unknown[];
const FRANKFURTER = fixture("frankfurter-latest.recorded.json");

const GLC: VehicleInput = { id: "00000000-0000-4000-8000-000000000043", vin: "WDC0J6EB0JF000000", make: "Mercedes-Benz", model: "GLC", year: 2018 };
const FAKE_KEYS: EngineKeys = {
  market_vincario_api_key: "test-vincario-api-key-A1B2",
  market_vincario_secret_key: "test-vincario-secret-C3D4",
  market_apify_token: "apify_api_test_token_E5F6",
};
const NO_KEYS: EngineKeys = { market_vincario_api_key: null, market_vincario_secret_key: null, market_apify_token: null };
const NOW = Date.parse("2026-10-15T09:00:00Z");
const DAY = 86_400_000;

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${(e as Error).message.split("\n").join("\n        ")}`);
  }
}
const close = (a: number | null | undefined, b: number, eps = 0.01) =>
  assert.ok(a != null && Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);

// --------------------------------------------------------------------------
// Fake dependencies + fetch spy for the runner.
// --------------------------------------------------------------------------
type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;
interface Fake {
  deps: EngineDeps;
  calls: { url: string; init?: RequestInit }[];
  saved: Partial<PriceRow>[];
  logs: LookupLog[];
  fxSaved: FxRow[];
  info: string[];
  touched: Set<string>;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fake(opts: {
  enabled?: boolean;
  keys?: EngineKeys;
  actor?: string | null;
  vehicle?: VehicleInput | null;
  previous?: PriceRow | null;
  claim?: boolean;
  fxToday?: FxRate | null;
  fxRecent?: FxRate | null;
  routes?: { vincario?: Route; apify?: Route; fx?: Route };
}): Fake {
  const f: Fake = { calls: [], saved: [], logs: [], fxSaved: [], info: [], touched: new Set(), deps: null as unknown as EngineDeps };
  const mark = (k: string) => f.touched.add(k);
  const routes = {
    vincario: opts.routes?.vincario ?? (() => json(VINCARIO_GLC)),
    apify: opts.routes?.apify ?? (() => json(APIFY_GLC)),
    fx: opts.routes?.fx ?? (() => json(FRANKFURTER)),
  };
  const spy = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    f.calls.push({ url, init });
    if (url.startsWith("https://api.vincario.com/")) return routes.vincario(url, init);
    if (url.startsWith("https://api.apify.com/")) return routes.apify(url, init);
    if (url.includes("frankfurter")) return routes.fx(url, init);
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  f.deps = {
    settings: async () => { mark("settings"); return { enabled: opts.enabled ?? true, actor: opts.actor === undefined ? "memo23/dubizzle-search-listing-s-scraper" : opts.actor }; },
    keys: async () => { mark("keys"); return opts.keys ?? FAKE_KEYS; },
    vehicle: async () => { mark("vehicle"); return opts.vehicle === undefined ? GLC : opts.vehicle; },
    priceRow: async () => { mark("priceRow"); return opts.previous ?? null; },
    claim: async () => { mark("claim"); return opts.claim ?? true; },
    save: async (_id, patch) => { mark("save"); f.saved.push(patch); },
    release: async () => { mark("release"); },
    fxToday: async () => { mark("fxToday"); return opts.fxToday ?? null; },
    fxRecent: async () => { mark("fxRecent"); return opts.fxRecent ?? null; },
    saveFx: async (row) => { mark("saveFx"); f.fxSaved.push(row); },
    log: async (rows) => { mark("log"); f.logs.push(...rows); },
    fetch: spy,
    now: () => NOW,
    info: (line) => f.info.push(line),
  };
  return f;
}

async function lookup(f: Fake, req: Partial<LookupRequest> = {}): Promise<LookupOutcome> {
  const p = await prepareLookup(f.deps, { vehicleId: GLC.id, trigger: "publish", ...req });
  return "outcome" in p ? p.outcome : runLookup(f.deps, p.job);
}

const prevRow = (over: Partial<PriceRow>): PriceRow => ({
  vehicle_id: GLC.id, uae_median_aed: null, uae_median_eur: null, uae_count: null, uae_status: null, uae_error: null,
  uae_source: null, uae_fetched_at: null, eu_median_eur: null, eu_count: null, eu_status: null, eu_error: null,
  eu_fetched_at: null, fx_rate: null, fx_date: null, ...over,
});

const timeout = () => { const e = new Error("timed out"); e.name = "TimeoutError"; throw e; };

// --------------------------------------------------------------------------
async function main() {
  console.log("Vincario (EU)");
  await test("docs example -> europe group median 6,700 from 29 listings, billed", () => {
    const r = parseVincarioMarketValue(VINCARIO_DOCS);
    assert.deepEqual(r, { status: "ok", medianEur: 6700, count: 29, error: null, charged: true });
  });
  await test("documented errors map to codes; insufficient data is not billed", () => {
    const code = (k: string) => parseVincarioMarketValue(VINCARIO_ERRORS[k]);
    assert.deepEqual(code("When we are not able to provide data"), { status: "insufficient_data", medianEur: null, count: null, error: "vincario_insufficient_data", charged: false });
    assert.equal(code("When you use an incorrect API key").error, "vincario_auth_failed");
    assert.equal(code("When you use an incorrect control sum").error, "vincario_auth_failed");
    assert.equal(code("When you run out of prepaid lookups").error, "vincario_out_of_lookups");
    assert.equal(code("When you reach a limit of requests per minute").error, "vincario_rate_limited");
    assert.equal(code("When VIN is not recognized").error, "vincario_vin_not_recognized");
    for (const v of Object.values(VINCARIO_ERRORS)) assert.equal(parseVincarioMarketValue(v).charged, false);
  });
  await test("a response without the europe group is not used (no other region stands in)", () => {
    const legacy = { vin: "WF05XXGC055870807", market_price: { price_count: 499, price_currency: "EUR", price_mean: 2200 } };
    assert.equal(parseVincarioMarketValue(legacy).status, "insufficient_data");
    assert.equal(parseVincarioMarketValue(legacy).error, "vincario_no_europe_group");
  });
  await test("control sum = first 10 hex of sha1(VIN|vehicle-market-value|key|secret), VIN upper-cased", async () => {
    const expected = createHash("sha1").update("XXXDEF1GH23456789|vehicle-market-value|KEY123|SECRET456").digest("hex").slice(0, 10);
    assert.equal(await vincarioControlSum("xxxdef1gh23456789", "KEY123", "SECRET456"), expected);
    assert.equal(vincarioMarketValueUrl("xxxdef1gh23456789", "KEY123", expected),
      `https://api.vincario.com/3.2/KEY123/${expected}/vehicle-market-value/XXXDEF1GH23456789.json`);
  });

  console.log("Dubizzle comparables (UAE)");
  await test("published sample -> AED 119,000, 2018, 128,000 km, Mercedes-Benz GLC", () => {
    assert.deepEqual(toComparable(APIFY_PUBLISHED[0]), { id: "16742808", priceAed: 119000, year: 2018, km: 128000, make: "Mercedes-Benz", model: "GLC" });
  });
  await test("published sample alone (1 listing) -> not enough UAE data", () => {
    const r = summarizeUae(APIFY_PUBLISHED, GLC as { make: string; model: string; year: number });
    assert.equal(r.status, "insufficient_data");
    assert.equal(r.error, "not_enough_uae_data");
    assert.equal(r.count, 1);
    assert.equal(r.medianAed, null);
  });
  await test("derived set: duplicate, 2015 car, instalment price and GLE rejected", () => {
    const { kept, rejected } = selectComparables(APIFY_GLC, { make: "Mercedes-Benz", model: "GLC", year: 2018 });
    assert.equal(rejected, 4);
    assert.equal(kept.length, 10);
    assert.ok(kept.every((c) => c.year! >= 2017 && c.year! <= 2019));
  });
  await test("derived set: extra-zero typo dropped as an outlier; median AED 121,000 of 9", () => {
    const r = summarizeUae(APIFY_GLC, { make: "Mercedes-Benz", model: "GLC", year: 2018 });
    assert.deepEqual(r, { status: "ok", medianAed: 121000, count: 9, matched: 10, outliers: 1, error: null });
  });
  await test("median: odd and even counts", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), null);
  });
  await test("outliers: small sample uses the 0.4x-2.5x median guard only", () => {
    assert.deepEqual(dropOutliers([110000, 400000, 100000]), { kept: [100000, 110000], dropped: [400000] });
  });
  await test("outliers: 20% above near-identical prices is normal variation, not an outlier", () => {
    assert.deepEqual(dropOutliers([100000, 100000, 100000, 100000, 120000]).dropped, []);
  });
  await test("outliers: IQR fences drop a far listing in a tight market", () => {
    const { dropped } = dropOutliers([100000, 102000, 104000, 106000, 108000, 210000]);
    assert.deepEqual(dropped, [210000]);
  });
  await test("fewer than 3 comparables -> not enough UAE data; exactly 3 -> priced", () => {
    const item = (price: number, year = 2018) => ({ listing: { listing_id: `${price}`, price: { raw: `${price}.00`, currency: "AED" } }, ad_ops: { year: `${year}`, make: "Mercedes-Benz", model: "GLC" } });
    const t = { make: "Mercedes-Benz", model: "GLC", year: 2018 };
    assert.equal(summarizeUae([item(100000), item(110000)], t).status, "insufficient_data");
    assert.equal(summarizeUae([item(100000), item(110000), item(400000)], t).status, "insufficient_data");
    const three = summarizeUae([item(100000), item(110000), item(120000)], t);
    assert.equal(three.status, "ok");
    assert.equal(three.medianAed, 110000);
  });
  await test("flat shape from a swapped actor (price, year, kilometers, make, model)", () => {
    assert.deepEqual(toComparable({ id: "x1", price: 98500, currency: "AED", year: 2019, kilometers: 61000, make: "BMW", model: "X5" }),
      { id: "x1", priceAed: 98500, year: 2019, km: 61000, make: "BMW", model: "X5" });
    assert.equal(toComparable({ price: { raw: "50000", currency: "USD" } }), null);
    assert.equal(toComparable({ price: "call for price" }), null);
  });
  await test("Dubizzle search URL: same make and model, year +/- 1", () => {
    assert.equal(dubizzleSearchUrl("Mercedes-Benz", "GLC", 2018), "https://dubai.dubizzle.com/motors/used-cars/mercedes-benz/glc/?year__gte=2017&year__lte=2019");
    assert.equal(dubizzleSlug("Land Rover"), "land-rover");
    assert.equal(dubizzleSlug("Range Rover Sport"), "range-rover-sport");
    assert.equal(dubizzleSlug("Citroën C5"), "citroen-c5");
  });
  await test("actor id from app_settings -> API path; anything else refused", () => {
    assert.equal(apifyActorPath("memo23/dubizzle-search-listing-s-scraper"), "memo23~dubizzle-search-listing-s-scraper");
    assert.equal(apifyActorPath("IDQfT4Wz30CqwIfR8"), "IDQfT4Wz30CqwIfR8");
    assert.equal(apifyActorPath("../../acts"), null);
    assert.equal(apifyActorPath("a/b/c"), null);
  });
  await test("Apify run: capped items and spend, token never in the URL", () => {
    const url = new URL(apifyRunUrl("memo23~dubizzle-search-listing-s-scraper"));
    assert.equal(url.searchParams.get("maxItems"), String(APIFY_MAX_ITEMS));
    assert.equal(url.searchParams.get("maxTotalChargeUsd"), String(APIFY_MAX_CHARGE_USD));
    assert.equal(url.searchParams.get("token"), null);
    assert.deepEqual(apifyRunInput("u"), { startUrls: ["u"], maxItems: APIFY_MAX_ITEMS, monitoringMode: false, enrichEmails: false });
  });
  await test("Apify cost estimate: $0.005 start + $0.00095 per result", () => {
    assert.equal(apifyCostUsd(0), 0.005);
    assert.equal(apifyCostUsd(50), 0.0525);
    assert.equal(apifyCostUsd(14), 0.0183);
  });

  console.log("FX (AED -> EUR)");
  await test("recorded ECB rate EUR/USD 1.1195 x peg 3.6725 -> 1 AED = EUR 0.24323", () => {
    const p = parseFrankfurter(FRANKFURTER);
    assert.deepEqual(p, { usdPerEur: 1.1195, ecbDate: "2026-10-14" });
    close(eurPerAed(p!.usdPerEur), 1 / (1.1195 * AED_PER_USD), 1e-12);
    close(eurPerAed(p!.usdPerEur), 0.243228, 1e-6);
  });
  await test("AED 121,000 -> EUR 29,430.62; AED 119,000 -> EUR 28,944.17", () => {
    const rate = eurPerAed(1.1195);
    assert.equal(aedToEur(121000, rate), 29430.62);
    assert.equal(aedToEur(119000, rate), 28944.17);
  });
  await test("bad FX responses are refused", () => {
    assert.equal(parseFrankfurter({ base: "USD", date: "2026-10-14", rates: { USD: 1 } }), null);
    assert.equal(parseFrankfurter({ base: "EUR", date: "2026-10-14", rates: {} }), null);
    assert.equal(parseFrankfurter({ base: "EUR", date: "yesterday", rates: { USD: 1.1 } }), null);
    assert.equal(parseFrankfurter({ base: "EUR", date: "2026-10-14", rates: { USD: 110 } }), null);
  });

  console.log("Reuse (7 days)");
  await test("ok or not-enough-data under 7 days is reused; errors and older results are not", () => {
    assert.equal(sideIsFresh("ok", new Date(NOW - 6 * DAY), NOW), true);
    assert.equal(sideIsFresh("insufficient_data", new Date(NOW - DAY).toISOString(), NOW), true);
    assert.equal(sideIsFresh("ok", new Date(NOW - 8 * DAY), NOW), false);
    assert.equal(sideIsFresh("error", new Date(NOW - DAY), NOW), false);
    assert.equal(sideIsFresh(null, null, NOW), false);
  });

  console.log("Runner: dormancy (no external call)");
  await test("flag off -> dormant, zero fetch calls, keys never read", async () => {
    const f = fake({ enabled: false });
    assert.deepEqual(await lookup(f), { status: "dormant", reason: "disabled" });
    assert.equal(f.calls.length, 0);
    assert.deepEqual([...f.touched], ["settings"]);
    assert.equal(f.info.length, 1);
    assert.match(f.info[0], /dormant: market_prices_enabled is off/);
  });
  await test("flag on, keys missing -> dormant with the missing names, zero fetch calls", async () => {
    const f = fake({ keys: NO_KEYS });
    assert.deepEqual(await lookup(f), { status: "dormant", reason: "keys_missing", missing: [...KEY_NAMES] });
    assert.equal(f.calls.length, 0);
    assert.ok(!f.touched.has("vehicle") && !f.touched.has("claim") && !f.touched.has("save"));
    assert.equal(f.info.length, 1);
  });
  await test("one key missing is still dormant", async () => {
    const f = fake({ keys: { ...FAKE_KEYS, market_apify_token: null } });
    assert.deepEqual(await lookup(f), { status: "dormant", reason: "keys_missing", missing: ["market_apify_token"] });
    assert.equal(f.calls.length, 0);
  });

  console.log("Runner: lookups against fixtures");
  await test("both sides from fixtures: UAE AED 121,000 (EUR 29,430.62) of 9, EU EUR 38,900 of 41", async () => {
    const f = fake({});
    const out = await lookup(f);
    assert.equal(out.status, "done");
    if (out.status !== "done") return;
    assert.deepEqual(out.eu, { status: "ok", median: 38900, count: 41, error: null });
    assert.deepEqual(out.uae, { status: "ok", median: 121000, count: 9, error: null, medianEur: 29430.62 });
    assert.equal(f.calls.length, 3);
    const saved = f.saved[0];
    assert.equal(saved.uae_median_aed, 121000);
    assert.equal(saved.uae_median_eur, 29430.62);
    assert.equal(saved.eu_median_eur, 38900);
    assert.equal(saved.fx_date, "2026-10-14");
    close(saved.fx_rate as number, 0.243228, 1e-6);
    assert.equal(saved.uae_source, "memo23/dubizzle-search-listing-s-scraper");
    assert.equal(f.fxSaved.length, 1);
  });
  await test("every lookup is logged with records and estimated cost", async () => {
    const f = fake({});
    await lookup(f);
    const by = Object.fromEntries(f.logs.map((l) => [l.service, l]));
    assert.deepEqual([by.vincario.success, by.vincario.records, by.vincario.est_cost, by.vincario.cost_currency], [true, 41, VINCARIO_COST_EUR, "EUR"]);
    assert.deepEqual([by.apify.success, by.apify.records, by.apify.est_cost, by.apify.cost_currency], [true, 14, 0.0183, "USD"]);
    assert.deepEqual([by.fx.success, by.fx.est_cost], [true, 0]);
    assert.ok(f.logs.every((l) => l.triggered_by === "publish" && l.vehicle_id === GLC.id));
  });
  await test("requests: Vincario by VIN, Apify with the token in a header and the Dubizzle search as input", async () => {
    const f = fake({});
    await lookup(f);
    const v = f.calls.find((c) => c.url.startsWith("https://api.vincario.com/"))!;
    assert.match(v.url, /\/vehicle-market-value\/WDC0J6EB0JF000000\.json$/);
    const a = f.calls.find((c) => c.url.startsWith("https://api.apify.com/"))!;
    assert.match(a.url, /\/v2\/acts\/memo23~dubizzle-search-listing-s-scraper\/run-sync-get-dataset-items\?/);
    assert.ok(!a.url.includes(FAKE_KEYS.market_apify_token!));
    assert.equal((a.init?.headers as Record<string, string>).Authorization, `Bearer ${FAKE_KEYS.market_apify_token}`);
    assert.deepEqual(JSON.parse(String(a.init?.body)).startUrls, ["https://dubai.dubizzle.com/motors/used-cars/mercedes-benz/glc/?year__gte=2017&year__lte=2019"]);
  });
  await test("no log line or saved row ever contains a key", async () => {
    const f = fake({ routes: { vincario: () => timeout() } });
    await lookup(f);
    const text = JSON.stringify([f.info, f.saved, f.logs]);
    for (const k of Object.values(FAKE_KEYS)) assert.ok(!text.includes(k!), "a key leaked");
  });
  await test("published samples end to end: EU 6,700 of 29; UAE 1 listing -> not enough data", async () => {
    const f = fake({ routes: { vincario: () => json(VINCARIO_DOCS), apify: () => json(APIFY_PUBLISHED) } });
    const out = await lookup(f);
    if (out.status !== "done") throw new Error(out.status);
    assert.deepEqual(out.eu, { status: "ok", median: 6700, count: 29, error: null });
    assert.equal(out.uae!.status, "insufficient_data");
    assert.equal(out.uae!.error, "not_enough_uae_data");
    assert.equal(f.saved[0].uae_status, "insufficient_data");
  });
  await test("one side failing never blocks the other (Vincario timeout, Apify fine)", async () => {
    const f = fake({ routes: { vincario: () => timeout() } });
    const out = await lookup(f);
    if (out.status !== "done") throw new Error(out.status);
    assert.equal(out.eu!.error, "vincario_timeout");
    assert.equal(out.uae!.status, "ok");
    assert.equal(f.saved[0].eu_status, "error");
    assert.equal(f.saved[0].uae_status, "ok");
    const v = f.logs.find((l) => l.service === "vincario")!;
    assert.deepEqual([v.success, v.est_cost], [false, 0]);
  });
  await test("Apify 401 -> UAE error, nothing billed; EU unaffected", async () => {
    const f = fake({ routes: { apify: () => json({ error: { type: "token-not-valid" } }, 401) } });
    const out = await lookup(f);
    if (out.status !== "done") throw new Error(out.status);
    assert.equal(out.uae!.error, "apify_auth_failed");
    assert.equal(out.eu!.status, "ok");
    assert.equal(f.logs.find((l) => l.service === "apify")!.est_cost, 0);
  });
  await test("Vincario 'insufficient statistical data' -> not enough EU data, not billed", async () => {
    const f = fake({ routes: { vincario: () => json(VINCARIO_ERRORS["When we are not able to provide data"]) } });
    const out = await lookup(f);
    if (out.status !== "done") throw new Error(out.status);
    assert.equal(out.eu!.status, "insufficient_data");
    assert.equal(f.logs.find((l) => l.service === "vincario")!.est_cost, 0);
  });
  await test("an error keeps the previous good result and records the error", async () => {
    const previous = prevRow({ eu_status: "ok", eu_median_eur: 40000, eu_count: 30, eu_fetched_at: new Date(NOW - 10 * DAY).toISOString(), uae_status: "ok", uae_fetched_at: new Date(NOW - DAY).toISOString() });
    const f = fake({ previous, routes: { vincario: () => json(VINCARIO_ERRORS["When you use an incorrect API key"]) } });
    const out = await lookup(f);
    assert.equal(out.status, "done");
    assert.deepEqual(f.saved[0], { eu_error: "vincario_auth_failed" });
  });
  await test("fresh result (< 7 days) is reused: no fetch, no claim", async () => {
    const recent = new Date(NOW - 2 * DAY).toISOString();
    const f = fake({ previous: prevRow({ eu_status: "ok", eu_fetched_at: recent, uae_status: "insufficient_data", uae_fetched_at: recent }) });
    assert.deepEqual(await lookup(f, { trigger: "relist" }), { status: "cached" });
    assert.equal(f.calls.length, 0);
    assert.ok(!f.touched.has("claim"));
  });
  await test("only the stale or failed side is fetched again", async () => {
    const f = fake({ previous: prevRow({ eu_status: "ok", eu_fetched_at: new Date(NOW - DAY).toISOString(), uae_status: "error", uae_fetched_at: new Date(NOW - DAY).toISOString() }) });
    const out = await lookup(f, { trigger: "relist" });
    if (out.status !== "done") throw new Error(out.status);
    assert.deepEqual(out.sides, ["uae"]);
    assert.ok(!f.calls.some((c) => c.url.startsWith("https://api.vincario.com/")));
  });
  await test("manual Refresh (force) runs both sides even when fresh", async () => {
    const recent = new Date(NOW - DAY).toISOString();
    const f = fake({ previous: prevRow({ eu_status: "ok", eu_fetched_at: recent, uae_status: "ok", uae_fetched_at: recent }) });
    const out = await lookup(f, { trigger: "refresh", force: true });
    if (out.status !== "done") throw new Error(out.status);
    assert.deepEqual(out.sides, ["eu", "uae"]);
  });
  await test("a lookup already running for the car -> in_progress, no fetch", async () => {
    const f = fake({ claim: false });
    assert.deepEqual(await lookup(f), { status: "in_progress" });
    assert.equal(f.calls.length, 0);
  });
  await test("today's FX rate is cached: no FX call", async () => {
    const f = fake({ fxToday: { eurPerAed: eurPerAed(1.1195), ecbDate: "2026-10-14" } });
    await lookup(f);
    assert.equal(f.calls.length, 2);
    assert.ok(!f.logs.some((l) => l.service === "fx"));
  });
  await test("FX down -> latest cached rate; none cached -> AED only, EUR left empty", async () => {
    const f1 = fake({ routes: { fx: () => json({}, 503) }, fxRecent: { eurPerAed: eurPerAed(1.10), ecbDate: "2026-10-10" } });
    await lookup(f1);
    assert.equal(f1.saved[0].fx_date, "2026-10-10");
    assert.equal(f1.logs.find((l) => l.service === "fx")!.success, false);
    const f2 = fake({ routes: { fx: () => timeout() } });
    await lookup(f2);
    assert.equal(f2.saved[0].uae_median_aed, 121000);
    assert.equal(f2.saved[0].uae_median_eur, null);
  });
  await test("car without a valid VIN -> EU error without a Vincario call; UAE still priced", async () => {
    const f = fake({ vehicle: { ...GLC, vin: "DEMOAPPREVIEW0001" } });
    const out = await lookup(f);
    if (out.status !== "done") throw new Error(out.status);
    assert.equal(out.eu!.error, "no_valid_vin");
    assert.equal(out.uae!.status, "ok");
    assert.ok(!f.calls.some((c) => c.url.startsWith("https://api.vincario.com/")));
  });
  await test("test lookup of one service runs only that side", async () => {
    const f = fake({});
    const out = await lookup(f, { trigger: "test", force: true, sides: ["eu"] });
    if (out.status !== "done") throw new Error(out.status);
    assert.equal(f.calls.length, 1);
    assert.equal(out.uae, null);
    assert.equal(f.saved[0].uae_status, undefined);
  });

  console.log("Card rules (web + app)");
  const row = (over: Partial<MarketPricesRow>): MarketPricesRow => ({
    uae_median_aed: 121000, uae_median_eur: 29430.62, uae_count: 9, uae_status: "ok", uae_fetched_at: "2026-10-15T09:00:00Z",
    eu_median_eur: 38900, eu_count: 41, eu_status: "ok", eu_fetched_at: "2026-10-15T08:59:00Z",
    fx_rate: 0.2432281, fx_date: "2026-10-14", ...over,
  });
  await test("both sides -> UAE, EU and the difference (EU EUR 9,469 higher, +32.2%)", () => {
    const v = marketPricesView(row({}), 490000)!;
    assert.deepEqual(v.uae, { kind: "market", aed: 121000, eur: 29430.62, count: 9 });
    assert.deepEqual(v.eu, { eur: 38900, count: 41 });
    assert.equal(v.difference!.eur, 9469);
    close(v.difference!.pct, 0.3217, 0.0001);
    assert.equal(v.updatedAt, "2026-10-15T09:00:00Z");
  });
  await test("only one side has data -> only that side", () => {
    const euOnly = marketPricesView(row({ uae_status: null, uae_median_aed: null, uae_median_eur: null, uae_count: null }), 490000)!;
    assert.equal(euOnly.uae, null);
    assert.equal(euOnly.difference, null);
    const uaeOnly = marketPricesView(row({ eu_status: "insufficient_data", eu_median_eur: null }), null)!;
    assert.equal(uaeOnly.eu, null);
    assert.equal(uaeOnly.uae!.kind, "market");
  });
  await test("neither side -> no card", () => {
    assert.equal(marketPricesView(row({ uae_status: "error", eu_status: "error" }), 490000), null);
    assert.equal(marketPricesView(null, 490000), null);
    assert.equal(marketPricesView(row({ uae_status: "insufficient_data", eu_status: "insufficient_data" }), 490000), null);
  });
  await test("UAE failed -> seller's asking price in the UAE slot, difference vs the asking price", () => {
    const v = marketPricesView(row({ uae_status: "insufficient_data", uae_median_aed: null, uae_median_eur: null, uae_count: 1 }), 125000)!;
    assert.deepEqual(v.uae, { kind: "asking", aed: 125000, eur: 30403.51 });
    assert.equal(v.difference!.basis, "asking");
    assert.equal(v.difference!.eur, 8496);
    assert.equal(v.updatedAt, "2026-10-15T08:59:00Z");
  });
  await test("UAE with fewer than 3 listings is never shown as a market price", () => {
    const v = marketPricesView(row({ uae_count: 2 }), null)!;
    assert.equal(v.uae, null);
  });
  await test("GCC note unless the car is European spec", () => {
    assert.equal(showSpecNote("GCC Specs"), true);
    assert.equal(showSpecNote(null), true);
    assert.equal(showSpecNote("American Specs"), true);
    assert.equal(showSpecNote("European Specs"), false);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
