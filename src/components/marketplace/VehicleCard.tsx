"use client";

import Link from "next/link";
import { Clock, Fuel, Gauge, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WatchlistButton } from "@/components/marketplace/WatchlistButton";
import { useTranslations, useLocale } from "@/i18n/provider";
import { cn, formatEur, formatKm } from "@/lib/utils";
import type { Vehicle, Auction } from "@/types";
import { useAuctionTick } from "@/hooks/useAuctionTick";

interface VehicleCardData extends Vehicle {
  vehicle_photos: { url: string; sort_order: number }[];
  /** Always normalized to an array by `normalizeVehicleRow` before reaching the card. */
  auctions: Auction[];
}

const localeMap: Record<string, string> = {
  en: "en-GB", de: "de-DE", ar: "ar-AE", fr: "fr-FR",
};

export function VehicleCard({
  vehicle,
  isWatching = false,
  isAuthenticated = false,
}: {
  vehicle: VehicleCardData;
  isWatching?: boolean;
  isAuthenticated?: boolean;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const intlLocale = localeMap[locale] ?? "en-GB";

  const auction = vehicle.auctions?.[0];
  const photo =
    vehicle.vehicle_photos?.sort((a, b) => a.sort_order - b.sort_order)[0]?.url
    ?? "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200&q=80";
  const isLive = auction && auction.status === "active";
  const remaining = useAuctionTick(auction?.end_time);
  const headlinePrice = isLive
    ? (auction?.current_bid_eur ?? auction?.starting_price_eur)
    : vehicle.listed_price_eur;

  return (
    <Link href={`/vehicle/${vehicle.id}`} className="group block">
      <Card className="overflow-hidden ring-1 ring-grey-200 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-grey-300">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-grey-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            {isLive ? (
              <Badge className="bg-error-50 text-error-700 ring-1 ring-error-100">
                <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-error-600" />
                {t("live")}
              </Badge>
            ) : auction?.status === "scheduled" ? (
              <Badge variant="outline" className="bg-white/90 text-grey-700">{t("scheduled")}</Badge>
            ) : null}
          </div>
          {isLive && (
            <div className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-grey-900/85 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              <Clock className="size-3" />
              {remaining}
            </div>
          )}
          <div className="absolute right-3 top-3">
            <WatchlistButton
              vehicleId={vehicle.id}
              initiallyWatching={isWatching}
              isAuthenticated={isAuthenticated}
              vehicleTitle={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              variant="icon"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold text-grey-900">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </h3>
              <p className="mt-0.5 truncate text-xs text-grey-500">
                {vehicle.exterior_color} · {vehicle.interior_color}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-grey-500">
                {isLive ? t("currentBid") : t("startingPrice")}
              </p>
              <p className="text-base font-extrabold text-grey-900">
                {formatEur(headlinePrice ?? 0, intlLocale)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Spec icon={Gauge}><span>{formatKm(vehicle.mileage_km, intlLocale)}</span></Spec>
            <Spec icon={Fuel}><span className="capitalize">{vehicle.fuel_type}</span></Spec>
            <Spec><span className="capitalize">{vehicle.transmission}</span></Spec>
            <Spec icon={MapPin}><span>{vehicle.location_city}</span></Spec>
          </div>

          {auction && (
            <div className="flex items-center justify-between border-t border-grey-100 pt-3 text-xs text-grey-500">
              <span>
                <strong className="text-grey-900">{auction.bid_count}</strong> {t("bids")} ·{" "}
                <strong className="text-grey-900">{auction.bidder_count}</strong> {t("bidders")}
              </span>
              {auction.reserve_price_eur != null && (
                <span className={cn(
                  "font-medium",
                  (auction.current_bid_eur ?? 0) >= auction.reserve_price_eur
                    ? "text-success-600" : "text-warning-600",
                )}>
                  {(auction.current_bid_eur ?? 0) >= auction.reserve_price_eur
                    ? t("reserveMet") : t("reserveNotMet")}
                </span>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

function Spec({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-grey-50 px-2 py-1 text-grey-700 ring-1 ring-grey-100">
      {Icon && <Icon className="size-3 text-grey-500" />}
      {children}
    </span>
  );
}

// Placeholder import — see hooks/useAuctionTick.ts for the implementation.
// (Re-exported here to avoid changing the import path elsewhere.)
