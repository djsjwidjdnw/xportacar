import { Heart } from "lucide-react";
import Link from "next/link";

import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import type { VehicleWithMedia } from "@/types";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const supabase = await createClient();
  const t = await getTranslations("nav");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: watchlist } = await supabase
    .from("watchlist")
    .select(`
      vehicle:vehicles!vehicle_id (
        *,
        vehicle_photos ( url, sort_order ),
        auctions ( id, status, end_time, current_bid_eur, starting_price_eur, reserve_price_eur, bid_count, bidder_count )
      )
    `)
    .eq("user_id", user.id);

  // deno-lint-ignore no-explicit-any
  const vehicles = ((watchlist ?? []) as any[])
    .map((row) => row.vehicle)
    .filter(Boolean) as VehicleWithMedia[];

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-error-50 text-error-600 ring-1 ring-error-100">
            <Heart className="size-5" />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">{t("watchlist")}</h1>
        </header>
        {vehicles.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
            <p className="text-base font-semibold text-grey-900">No vehicles on your watchlist yet.</p>
            <p className="mt-1 text-sm text-grey-500">
              Add cars from the <Link href="/marketplace" className="text-brand-700 hover:underline">marketplace</Link>.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                isWatching={true}
                isAuthenticated={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
