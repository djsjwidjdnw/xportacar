import { Gavel } from "lucide-react";

import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { createClient } from "@/lib/supabase/server";
import { normalizeVehicleRows } from "@/lib/supabase/normalize";
import { getTranslations } from "@/i18n/server";
import { auctionPhase } from "@/lib/utils";
import type { VehicleWithMedia } from "@/types";

export const metadata = { title: "Live auctions" };

export default async function AuctionsPage() {
  const supabase = await createClient();
  const t = await getTranslations();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("vehicles")
    .select(`
      *,
      vehicle_photos ( url, sort_order ),
      auctions!inner ( id, status, start_time, end_time, current_bid_eur, starting_price_eur, reserve_price_eur, bid_count, bidder_count )
    `)
    .eq("status", "in_auction")
    .eq("auctions.status", "active");

  // Exclude any auction whose end_time has already passed — the DB status can
  // lag, so "active" alone isn't enough to call it live.
  const list: VehicleWithMedia[] = normalizeVehicleRows(data as unknown as Record<string, unknown>[], { stripSeller: true })
    .filter((v) => auctionPhase(v.auctions[0]) === "live");
  list.sort((a, b) => {
    const ae = a.auctions[0]?.end_time;
    const be = b.auctions[0]?.end_time;
    return new Date(ae ?? 0).getTime() - new Date(be ?? 0).getTime();
  });

  let watchSet = new Set<string>();
  if (user) {
    const { data: w } = await supabase
      .from("watchlist")
      .select("vehicle_id")
      .eq("user_id", user.id);
    watchSet = new Set((w ?? []).map((r) => (r as { vehicle_id: string }).vehicle_id));
  }

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-error-50 text-error-600 ring-1 ring-error-100">
            <Gavel className="size-5" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
              {t("nav.auctions")}
            </h1>
            <p className="text-grey-600">
              {t("marketplace.resultsCount", { count: list.length })} · {t("common.live")}
            </p>
          </div>
          <div className="ml-auto">
            <CurrencyPills />
          </div>
        </header>

        {list.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
            <Gavel className="mb-3 size-8 text-grey-400" />
            <p className="text-base font-semibold text-grey-900">No live auctions right now.</p>
            <p className="mt-1 text-sm text-grey-500">Next batch is being inspected — check back tomorrow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
