import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MarketPricesRow } from "@/lib/market-prices-view";

// Server side of the UAE vs EU market prices (migration 034, Edge Function
// market-prices). Lookups run once per listing, when an admin publishes or
// relists a car; buyer pages only read the stored row.

export type MarketPriceTrigger = "publish" | "relist";

export interface MarketPricesRecord extends MarketPricesRow {
  uae_error: string | null;
  eu_error: string | null;
  fetched_at: string | null;
}

const COLUMNS =
  "uae_median_aed, uae_median_eur, uae_count, uae_status, uae_error, uae_fetched_at, " +
  "eu_median_eur, eu_count, eu_status, eu_error, eu_fetched_at, fx_rate, fx_date, fetched_at";

/** The stored market prices for a car (RLS: public cars for everyone, all cars for admins). */
export async function getVehicleMarketPrices(supabase: SupabaseClient, vehicleId: string): Promise<MarketPricesRecord | null> {
  try {
    const { data, error } = await supabase
      .from("vehicle_market_prices").select(COLUMNS).eq("vehicle_id", vehicleId).maybeSingle();
    if (error) return null;
    return (data as MarketPricesRecord | null) ?? null;
  } catch {
    return null;
  }
}

export async function marketPricesEnabled(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "market_prices_enabled").maybeSingle();
    return (data as { value?: unknown } | null)?.value === true;
  } catch {
    return false;
  }
}

/**
 * Ask the market-prices Edge Function to price a car after a publish or
 * relist. Call it inside after(): it never delays or fails the publish. While
 * market prices are off it logs one line and makes no call at all, so
 * publishing works exactly as before. The function itself answers at once and
 * reuses a result under 7 days old.
 */
export async function requestMarketPrices(
  supabase: SupabaseClient,
  vehicleId: string,
  trigger: MarketPriceTrigger,
): Promise<string> {
  try {
    if (!(await marketPricesEnabled(supabase))) {
      console.info(`[market-prices] dormant (market_prices_enabled is off): no lookup for vehicle ${vehicleId} (${trigger})`);
      return "dormant";
    }
    const { data, error } = await supabase.functions.invoke("market-prices", {
      body: { action: "lookup", vehicle_id: vehicleId, trigger },
    });
    if (error) {
      console.error(`[market-prices] lookup request failed for vehicle ${vehicleId} (${trigger}): ${error.message}`);
      return "error";
    }
    const status = (data as { status?: string } | null)?.status ?? "unknown";
    console.info(`[market-prices] vehicle ${vehicleId} (${trigger}): ${status}`);
    return status;
  } catch (e) {
    console.error(`[market-prices] lookup request threw for vehicle ${vehicleId} (${trigger}): ${(e as Error)?.name ?? "error"}`);
    return "error";
  }
}
