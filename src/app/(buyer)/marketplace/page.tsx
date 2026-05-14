import { Search } from "lucide-react";

import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { SaveSearchButton } from "@/components/marketplace/SaveSearchButton";
import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { createClient } from "@/lib/supabase/server";
import { normalizeVehicleRows } from "@/lib/supabase/normalize";
import { getTranslations } from "@/i18n/server";
import type { VehicleWithMedia } from "@/types";

interface SearchParams {
  q?: string;
  make?: string;
  year?: string;
  price?: string;
  fuel?: string;
  body?: string;
  transmission?: string;
  sort?: string;
}

export const metadata = { title: "Marketplace" };

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("vehicles")
    .select(`
      *,
      vehicle_photos ( url, sort_order ),
      auctions ( id, status, start_time, end_time, current_bid_eur, starting_price_eur, reserve_price_eur, bid_count, bidder_count )
    `)
    .in("status", ["listed", "in_auction"]);

  if (sp.make && sp.make !== "All makes") query = query.eq("make", sp.make);
  if (sp.year && sp.year !== "any")        query = query.eq("year", Number(sp.year));
  if (sp.fuel && sp.fuel !== "All fuel types")
    query = query.eq("fuel_type", sp.fuel as VehicleWithMedia["fuel_type"]);
  if (sp.body && sp.body !== "All body types") query = query.eq("body_type", sp.body);
  if (sp.transmission && sp.transmission !== "All")
    query = query.eq("transmission", sp.transmission as VehicleWithMedia["transmission"]);

  if (sp.price && sp.price !== "any") {
    const [minStr, maxStr] = sp.price.split("-");
    if (sp.price.endsWith("+")) {
      query = query.gte("listed_price_eur", Number(minStr.replace("+", "")) * 1000);
    } else {
      query = query.gte("listed_price_eur", Number(minStr) * 1000)
                   .lte("listed_price_eur", Number(maxStr) * 1000);
    }
  }

  if (sp.q) {
    const safe = sp.q.replace(/[%_,()]/g, "\\$&");
    // Standard text search: make / model / vin / description.  If the user
    // typed a 4-digit year, also match year=N — gives "2023" a useful result.
    const clauses = [
      `make.ilike.%${safe}%`,
      `model.ilike.%${safe}%`,
      `vin.ilike.%${safe}%`,
      `description.ilike.%${safe}%`,
    ];
    const yearMatch = /^\s*(19|20)\d{2}\s*$/.exec(sp.q);
    if (yearMatch) clauses.push(`year.eq.${Number(yearMatch[0])}`);
    query = query.or(clauses.join(","));
  }

  switch (sp.sort) {
    case "price_asc":   query = query.order("listed_price_eur", { ascending: true,  nullsFirst: false }); break;
    case "price_desc":  query = query.order("listed_price_eur", { ascending: false, nullsFirst: false }); break;
    case "newest":      query = query.order("created_at",       { ascending: false }); break;
    case "mileage_asc": query = query.order("mileage_km",       { ascending: true });  break;
    case "ending_soon":
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data: vehicles, error } = await query;
  const list: VehicleWithMedia[] = normalizeVehicleRows(vehicles as unknown as Record<string, unknown>[]);

  let watchSet = new Set<string>();
  if (user) {
    const { data: w } = await supabase
      .from("watchlist")
      .select("vehicle_id")
      .eq("user_id", user.id);
    watchSet = new Set((w ?? []).map((r) => (r as { vehicle_id: string }).vehicle_id));
  }

  // Default sort "ending soon" — sort in JS so we can sort by joined auction.end_time.
  if ((sp.sort ?? "ending_soon") === "ending_soon") {
    list.sort((a, b) => {
      const ae = a.auctions.find((x) => x.status === "active")?.end_time;
      const be = b.auctions.find((x) => x.status === "active")?.end_time;
      if (ae && be) return new Date(ae).getTime() - new Date(be).getTime();
      if (ae) return -1;
      if (be) return 1;
      return 0;
    });
  }

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            {t("marketplace.title")}
          </h1>
          <p className="mt-2 text-grey-600">
            {t("marketplace.subtitle", { count: list.length })}
          </p>
        </header>

        <div className="rounded-2xl border border-grey-200 bg-white p-4 shadow-xs">
          <MarketplaceFilters />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-grey-600">
          <span>{t("marketplace.resultsCount", { count: list.length })}</span>
          <SaveSearchButton isAuthenticated={!!user} />
        </div>

        {error ? (
          <div className="mt-12 rounded-xl border border-error-200 bg-error-50 p-6 text-error-700">
            {error.message}
          </div>
        ) : list.length === 0 ? (
          <div className="mt-16 grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
            <Search className="mb-3 size-8 text-grey-400" />
            <p className="text-base font-semibold text-grey-900">{t("marketplace.noResults")}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                isWatching={watchSet.has(v.id)}
                isAuthenticated={!!user}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
