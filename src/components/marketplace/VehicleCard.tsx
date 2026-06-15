"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Fuel, Gauge, Gavel, Hourglass, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WatchlistButton } from "@/components/marketplace/WatchlistButton";
import { useTranslations, useLocale } from "@/i18n/provider";
import { useCurrency } from "@/lib/currency";
import {
  auctionPhase, cn, formatKm, formatTimeRemaining, isEndingSoon,
  pickThumbnailPhoto, thumb,
} from "@/lib/utils";
import { estimateValuation } from "@/lib/valuation";
import type { Vehicle, Auction } from "@/types";

interface VehicleCardData extends Vehicle {
  vehicle_photos: { url: string; sort_order: number; caption?: string | null; category?: string | null }[];
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
  const { format } = useCurrency();

  const auction = vehicle.auctions?.[0];

  // Tick once a second so the countdown ticks and the card flips itself to
  // "Ended" the instant end_time passes — no stale "Live" badge on reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!auction) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
    // Only the auction identity matters for (re)starting the ticker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.id]);

  const phase = auctionPhase(auction, now);
  const live = phase === "live";
  const ended = phase === "ended";
  const scheduled = phase === "scheduled";
  const endingSoon = isEndingSoon(auction, now);
  const remaining = auction?.end_time ? formatTimeRemaining(auction.end_time, new Date(now)) : "";

  // Neutral local placeholder when a vehicle has no photos — never a random
  // stock car (that caused the "Mustang on a Range Rover" mismatch).
  // Prefer the front-right 3/4 exterior shot so the card framing is consistent.
  const photo =
    pickThumbnailPhoto(vehicle.vehicle_photos)?.url
    ?? "/placeholder/no-photo.svg";

  const headlinePrice = live || ended
    ? (auction?.current_bid_eur ?? auction?.starting_price_eur ?? vehicle.listed_price_eur)
    : vehicle.listed_price_eur;

  const marketAvg = estimateValuation({
    make: vehicle.make, model: vehicle.model, year: vehicle.year, mileageKm: vehicle.mileage_km,
  }).avgEur;

  const startLabel = auction?.start_time
    ? new Date(auction.start_time).toLocaleDateString(intlLocale, { day: "numeric", month: "short" })
    : null;

  return (
    <Link href={`/vehicle/${vehicle.id}`} className="group block">
      <Card className="max-w-full overflow-hidden ring-1 ring-grey-200 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-grey-300">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb(photo, 600)}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            className={cn(
              // Bring-A-Trailer style: object-cover fills the 4:3 frame
              // edge-to-edge, car centred — photos frame the vehicle with some
              // natural crop (accepted). bg-white shows through only at the
              // instant before load. (Detail-page hero is separate, contain.)
              "size-full max-w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]",
              ended && "opacity-90",
            )}
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            {ended ? (
              <Badge className="bg-grey-800/90 text-white ring-1 ring-grey-700">{t("ended")}</Badge>
            ) : live ? (
              <Badge className={cn(
                "ring-1",
                endingSoon
                  ? "bg-error-600 text-white ring-error-500"
                  : "bg-error-50 text-error-700 ring-error-100",
              )}>
                <span className={cn(
                  "mr-1 inline-block size-1.5 animate-pulse rounded-full",
                  endingSoon ? "bg-white" : "bg-error-600",
                )} />
                {endingSoon ? t("endingSoon") : t("live")}
              </Badge>
            ) : scheduled ? (
              <Badge variant="outline" className="bg-white/90 text-grey-700">{t("scheduled")}</Badge>
            ) : null}
          </div>
          {live && (
            <div className={cn(
              "absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white backdrop-blur",
              endingSoon ? "bg-error-600/90" : "bg-grey-900/85",
            )}>
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
                {vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ` ${vehicle.trim}` : ""}
              </h3>
              <p className="mt-0.5 truncate text-xs text-grey-500">
                {vehicle.exterior_color} · {vehicle.interior_color}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-grey-500">
                {ended ? t("ended") : live ? t("currentBid") : t("startingPrice")}
              </p>
              <p className="text-base font-extrabold text-grey-900 tabular-nums">
                {format(headlinePrice ?? 0)}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-grey-500 tabular-nums">
                Market {format(marketAvg)}
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

          {/* Prominent CTA — makes auction state obvious at a glance. */}
          {live && auction ? (
            <Link
              href={`/auction/${auction.id}`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold text-white shadow-sm transition-colors",
                endingSoon ? "bg-error-600 hover:bg-error-700" : "bg-brand-600 hover:bg-brand-700",
              )}
            >
              {endingSoon ? <Clock className="size-4" /> : <Gavel className="size-4" />}
              {endingSoon ? t("endingSoon") : t("bidNow")}
            </Link>
          ) : scheduled ? (
            <div className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 text-sm font-bold text-warning-700">
              <Hourglass className="size-4" />
              {startLabel ? t("comingSoonStarts", { date: startLabel }) : t("comingSoon")}
            </div>
          ) : ended ? (
            <div className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-grey-200 bg-grey-100 px-3 text-sm font-semibold text-grey-500">
              {t("ended")}
            </div>
          ) : (
            <div className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-grey-200 bg-grey-50 px-3 text-sm font-semibold text-grey-600">
              {t("viewDetails")}
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
