// Shared marketplace query helpers — used by both the page (SSR page 0) and
// the "load more" server action so filtering/sorting/paging stay identical.
// At 100k+ vehicles we never SELECT the whole table: every fetch is a 20-row
// range, and the header total comes from a head-only COUNT.

import { normalizeVehicleRows } from "@/lib/supabase/normalize";
import type { VehicleWithMedia } from "@/types";

export const PAGE_SIZE = 20;

export interface MarketplaceSearchParams {
  q?: string;
  make?: string;
  year?: string;
  price?: string;
  fuel?: string;
  body?: string;
  transmission?: string;
  sort?: string;
}

const SELECT = `
  *,
  vehicle_photos ( url, sort_order ),
  auctions ( id, status, start_time, end_time, current_bid_eur, starting_price_eur, reserve_price_eur, bid_count, bidder_count )
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, sp: MarketplaceSearchParams) {
  if (sp.make && sp.make !== "All makes")          q = q.eq("make", sp.make);
  if (sp.year && sp.year !== "any")                q = q.eq("year", Number(sp.year));
  if (sp.fuel && sp.fuel !== "All fuel types")     q = q.eq("fuel_type", sp.fuel);
  if (sp.body && sp.body !== "All body types")     q = q.eq("body_type", sp.body);
  if (sp.transmission && sp.transmission !== "All") q = q.eq("transmission", sp.transmission);

  if (sp.price && sp.price !== "any") {
    const [minStr, maxStr] = sp.price.split("-");
    if (sp.price.endsWith("+")) {
      q = q.gte("listed_price_eur", Number(minStr.replace("+", "")) * 1000);
    } else {
      q = q.gte("listed_price_eur", Number(minStr) * 1000)
           .lte("listed_price_eur", Number(maxStr) * 1000);
    }
  }

  if (sp.q) {
    const safe = sp.q.replace(/[%_,()]/g, "\\$&");
    const clauses = [
      `make.ilike.%${safe}%`,
      `model.ilike.%${safe}%`,
      `vin.ilike.%${safe}%`,
      `description.ilike.%${safe}%`,
    ];
    const yearMatch = /^\s*(19|20)\d{2}\s*$/.exec(sp.q);
    if (yearMatch) clauses.push(`year.eq.${Number(yearMatch[0])}`);
    q = q.or(clauses.join(","));
  }
  return q;
}

// SQL-level ordering. "ending_soon" (the default) orders by recency as a
// stable pagination cursor; the client then tiers the loaded set
// live → scheduled → listed → ended for display.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySort(q: any, sort?: string) {
  switch (sort) {
    case "price_asc":   return q.order("listed_price_eur", { ascending: true,  nullsFirst: false });
    case "price_desc":  return q.order("listed_price_eur", { ascending: false, nullsFirst: false });
    case "mileage_asc": return q.order("mileage_km",       { ascending: true });
    default:            return q.order("created_at",       { ascending: false });
  }
}

/** Fetch one page of marketplace vehicles + whether more exist. */
export async function fetchVehiclesPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sp: MarketplaceSearchParams,
  offset: number,
  limit = PAGE_SIZE,
): Promise<{ vehicles: VehicleWithMedia[]; hasMore: boolean }> {
  let q = supabase.from("vehicles").select(SELECT).in("status", ["listed", "in_auction"]);
  q = applyFilters(q, sp);
  q = applySort(q, sp.sort);
  // Fetch one extra row to detect whether another page exists.
  const { data } = await q.range(offset, offset + limit);
  const rows = (data ?? []) as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  return { vehicles: normalizeVehicleRows(hasMore ? rows.slice(0, limit) : rows), hasMore };
}

/** Total matching count for the header — head-only, no rows transferred. */
export async function fetchVehiclesCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sp: MarketplaceSearchParams,
): Promise<number> {
  let q = supabase.from("vehicles").select("id", { count: "exact", head: true }).in("status", ["listed", "in_auction"]);
  q = applyFilters(q, sp);
  const { count } = await q;
  return count ?? 0;
}
