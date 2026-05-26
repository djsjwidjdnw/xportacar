import "server-only";

// Server-side valuation with 7-day Supabase caching. Order: cache → live API
// (if VALUATION_API_KEY set) → reference-table estimate. Writes the result to
// the vehicle_valuations cache via the service-role client. Every step is
// best-effort: if the cache table doesn't exist yet or the admin client isn't
// configured, it transparently falls back to the estimate.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  estimateValuation, fetchMarketValuation, type Valuation, type ValuationInput,
} from "@/lib/valuation";

const CACHE_DAYS = 7;
const bucketKm = (km?: number) => Math.round((km ?? 0) / 10_000) * 10_000;

async function liveOrEstimate(input: ValuationInput): Promise<Valuation> {
  const key = process.env.VALUATION_API_KEY ?? process.env.AUTODEV_API_KEY ?? "";
  if (key) {
    const live = await fetchMarketValuation(input, key);
    if (live) return live;
  }
  return estimateValuation(input);
}

export async function getVehicleValuation(
  input: ValuationInput & { vehicleId?: string | null },
): Promise<Valuation> {
  const make = input.make?.trim() ?? "";
  const model = input.model?.trim() ?? "";
  const year = Number(input.year) || 0;
  if (!make || !model || !year) return estimateValuation(input);

  const mileageKm = bucketKm(input.mileageKm);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  try { admin = createAdminClient(); } catch { return liveOrEstimate(input); }

  // 1) Cache hit within 7 days.
  try {
    const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
    const { data } = await admin
      .from("vehicle_valuations")
      .select("min_eur, avg_eur, max_eur, data_points, source, confidence")
      .eq("make", make).eq("model", model).eq("year", year).eq("mileage_km", mileageKm)
      .gte("fetched_at", since)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        minEur: Number(data.min_eur),
        avgEur: Number(data.avg_eur),
        maxEur: Number(data.max_eur),
        dataPoints: data.data_points ?? 0,
        source: data.source === "market_data" ? "market_data" : "estimate",
        confidence: ["high", "medium", "low"].includes(data.confidence) ? data.confidence : "low",
      };
    }
  } catch { /* table missing — fall through to compute */ }

  // 2) Live API or 3) estimate.
  const val = await liveOrEstimate(input);

  // Cache (best-effort).
  try {
    await admin.from("vehicle_valuations").insert({
      vehicle_id: input.vehicleId ?? null,
      make, model, year, mileage_km: mileageKm,
      min_eur: val.minEur, avg_eur: val.avgEur, max_eur: val.maxEur,
      data_points: val.dataPoints, source: val.source, confidence: val.confidence,
    });
  } catch { /* ignore cache write failure */ }

  return val;
}
