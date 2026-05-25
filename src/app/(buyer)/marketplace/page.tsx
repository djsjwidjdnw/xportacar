import { Search } from "lucide-react";

import { MarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { SaveSearchButton } from "@/components/marketplace/SaveSearchButton";
import { MarketplaceResults } from "@/components/marketplace/MarketplaceResults";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { fetchVehiclesPage, fetchVehiclesCount, type MarketplaceSearchParams } from "./query";

export const metadata = { title: "Marketplace" };

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceSearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations();
  const { data: { user } } = await supabase.auth.getUser();

  // Page 0 only (20 rows) + a head-only total count — never the whole table.
  const [{ vehicles: page0, hasMore }, total] = await Promise.all([
    fetchVehiclesPage(supabase, sp, 0),
    fetchVehiclesCount(supabase, sp),
  ]);

  // Watch state for just the first page's vehicles.
  let watching: string[] = [];
  if (user && page0.length > 0) {
    const { data: w } = await supabase
      .from("watchlist")
      .select("vehicle_id")
      .eq("user_id", user.id)
      .in("vehicle_id", page0.map((v) => v.id));
    watching = (w ?? []).map((r) => (r as { vehicle_id: string }).vehicle_id);
  }

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            {t("marketplace.title")}
          </h1>
          <p className="mt-2 text-grey-600">
            {t("marketplace.subtitle", { count: total })}
          </p>
        </header>

        <div className="rounded-2xl border border-grey-200 bg-white p-4 shadow-xs">
          <MarketplaceFilters />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-grey-600">
          <span>{t("marketplace.resultsCount", { count: total })}</span>
          <div className="flex items-center gap-3">
            <CurrencyPills />
            <SaveSearchButton isAuthenticated={!!user} />
          </div>
        </div>

        {page0.length === 0 ? (
          <div className="mt-16 grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
            <Search className="mb-3 size-8 text-grey-400" />
            <p className="text-base font-semibold text-grey-900">{t("marketplace.noResults")}</p>
          </div>
        ) : (
          <MarketplaceResults
            initialVehicles={page0}
            sp={sp}
            initialHasMore={hasMore}
            initialWatching={watching}
            isAuthenticated={!!user}
          />
        )}
      </div>
    </div>
  );
}
