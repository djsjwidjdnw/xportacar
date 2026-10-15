// What the "Market prices" card shows, from a vehicle_market_prices row (see
// migration 034 and the market-prices Edge Function). Pure and client-safe.
// The buyer app keeps a copy of these rules in src/lib/marketPrices.ts.
//
//   - Each side shows only when it has data (status ok). Neither -> no card.
//   - UAE side failed (error or not enough listings) while the EU side has
//     data -> the seller's asking price (vehicles.price_aed) takes the UAE
//     slot, labelled as the asking price, never as a market price.
//   - The difference is EU minus UAE (the UAE market median, or the asking price).

export const MIN_UAE_LISTINGS = 3;

export interface MarketPricesRow {
  uae_median_aed: number | string | null;
  uae_median_eur: number | string | null;
  uae_count: number | null;
  uae_status: string | null;
  uae_fetched_at: string | null;
  eu_median_eur: number | string | null;
  eu_count: number | null;
  eu_status: string | null;
  eu_fetched_at: string | null;
  fx_rate: number | string | null;
  fx_date: string | null;
}

export type UaeSlot =
  | { kind: "market"; aed: number; eur: number | null; count: number }
  | { kind: "asking"; aed: number; eur: number | null };

export interface MarketPricesView {
  uae: UaeSlot | null;
  eu: { eur: number; count: number } | null;
  /** EU minus UAE, in EUR; pct is relative to the UAE figure. */
  difference: { eur: number; pct: number; basis: "market" | "asking" } | null;
  /** Newest lookup date among the market figures shown. */
  updatedAt: string | null;
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function marketPricesView(
  row: MarketPricesRow | null | undefined,
  askingPriceAed: number | string | null | undefined,
): MarketPricesView | null {
  if (!row) return null;

  const euEur = num(row.eu_median_eur);
  const eu = row.eu_status === "ok" && euEur != null && euEur > 0
    ? { eur: euEur, count: num(row.eu_count) ?? 0 }
    : null;

  const uaeAed = num(row.uae_median_aed);
  const uaeCount = num(row.uae_count) ?? 0;
  const uaeMarket: UaeSlot | null = row.uae_status === "ok" && uaeAed != null && uaeAed > 0 && uaeCount >= MIN_UAE_LISTINGS
    ? { kind: "market", aed: uaeAed, eur: num(row.uae_median_eur), count: uaeCount }
    : null;

  if (!eu && !uaeMarket) return null;

  const rate = num(row.fx_rate);
  const asking = num(askingPriceAed);
  const uaeFailed = row.uae_status === "error" || row.uae_status === "insufficient_data";
  const uae: UaeSlot | null = uaeMarket ?? (eu && uaeFailed && asking != null && asking > 0
    ? { kind: "asking", aed: asking, eur: rate != null && rate > 0 ? Math.round(asking * rate * 100) / 100 : null }
    : null);

  const uaeEur = uae?.eur ?? null;
  const difference = eu && uae && uaeEur != null && uaeEur > 0
    ? { eur: Math.round(eu.eur - uaeEur), pct: (eu.eur - uaeEur) / uaeEur, basis: uae.kind }
    : null;

  const dates = [eu ? row.eu_fetched_at : null, uaeMarket ? row.uae_fetched_at : null]
    .filter((d): d is string => !!d)
    .sort();
  return { uae, eu, difference, updatedAt: dates.length ? dates[dates.length - 1] : null };
}

/** The GCC-vs-EU-spec note is shown unless the car itself is European spec. */
export function showSpecNote(marketSpec: string | null | undefined): boolean {
  return !/europe|\beu\b/i.test(marketSpec ?? "");
}
