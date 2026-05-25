"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { VehicleCard } from "@/components/marketplace/VehicleCard";
import { useTranslations } from "@/i18n/provider";
import { auctionPhase } from "@/lib/utils";
import { loadMoreVehiclesAction } from "@/app/(buyer)/marketplace/actions";
import type { MarketplaceSearchParams } from "@/app/(buyer)/marketplace/query";
import type { VehicleWithMedia } from "@/types";

export function MarketplaceResults({
  initialVehicles,
  sp,
  initialHasMore,
  initialWatching,
  isAuthenticated,
}: {
  initialVehicles: VehicleWithMedia[];
  sp: MarketplaceSearchParams;
  initialHasMore: boolean;
  initialWatching: string[];
  isAuthenticated: boolean;
}) {
  const t = useTranslations("marketplace");
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [watching, setWatching] = useState(() => new Set(initialWatching));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, start] = useTransition();

  // Default view ("ending soon") tiers the loaded set live → scheduled →
  // listed → ended so ENDED auctions stay at the bottom. Explicit sorts keep
  // the SQL order they arrived in.
  const display = useMemo(() => {
    if ((sp.sort ?? "ending_soon") !== "ending_soon") return vehicles;
    const rank = (v: VehicleWithMedia) => {
      const ph = auctionPhase(v.auctions?.[0]);
      return ph === "live" ? 0 : ph === "scheduled" ? 1 : ph === "ended" ? 3 : 2;
    };
    return [...vehicles].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      const aa = a.auctions?.[0], ba = b.auctions?.[0];
      if (ra === 0 && aa && ba) return new Date(aa.end_time).getTime() - new Date(ba.end_time).getTime();
      if (ra === 1 && aa && ba) return new Date(aa.start_time).getTime() - new Date(ba.start_time).getTime();
      if (ra === 3 && aa && ba) return new Date(ba.end_time).getTime() - new Date(aa.end_time).getTime();
      return 0;
    });
  }, [vehicles, sp.sort]);

  const loadMore = () => {
    start(async () => {
      const res = await loadMoreVehiclesAction(sp, vehicles.length);
      setVehicles((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...res.vehicles.filter((v) => !seen.has(v.id))];
      });
      setWatching((prev) => new Set([...prev, ...res.watching]));
      setHasMore(res.hasMore);
    });
  };

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {display.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            isWatching={watching.has(v.id)}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-grey-300 bg-white px-6 text-sm font-bold text-grey-800 shadow-xs transition-colors hover:border-grey-400 hover:bg-grey-50 disabled:opacity-60"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? t("loadingMore") : t("loadMore")}
          </button>
        </div>
      )}
    </>
  );
}
