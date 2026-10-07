"use client";

// Marketplace card for the fixed-price marketplace (app_settings.bidding_enabled
// off): one price, the days left on the 7-day listing, and a Buy CTA. The whole
// card links to the vehicle page, where the KYC-gated purchase happens.

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Fuel, Gauge, MapPin, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { WatchlistButton } from "@/components/marketplace/WatchlistButton";
import { useLocale, useTranslations } from "@/i18n/provider";
import { useCurrency } from "@/lib/currency";
import { daysLeftLabel, listingDaysLeft, listingPrice, listingState } from "@/lib/listing";
import { cn, formatKm, pickThumbnailPhoto, thumb } from "@/lib/utils";
import { estimateValuation } from "@/lib/valuation";
import type { Auction, Vehicle } from "@/types";

const LOCALE_MAP: Record<string, string> = { en: "en-GB", de: "de-DE", ar: "ar-AE", fr: "fr-FR" };

export interface ListingCardVehicle extends Vehicle {
  vehicle_photos: { url: string; sort_order: number; caption?: string | null; category?: string | null }[];
  /** Always normalized to an array by `normalizeVehicleRow` before reaching the card. */
  auctions: Auction[];
}

export function ListingCard({
  vehicle,
  isWatching = false,
  isAuthenticated = false,
}: {
  vehicle: ListingCardVehicle;
  isWatching?: boolean;
  isAuthenticated?: boolean;
}) {
  const t = useTranslations();
  const intlLocale = LOCALE_MAP[useLocale()] ?? "en-GB";
  const { format } = useCurrency();
  const listing = vehicle.auctions?.[0];

  // Days are the unit here, so a once-a-minute tick is plenty to flip a card to
  // "ended" when its 7 days run out while the page is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const state = listingState(listing, now);
  const lastDay = state === "live" && listingDaysLeft(listing?.end_time, now) <= 1;
  const price = listingPrice(listing, vehicle);
  const photo = pickThumbnailPhoto(vehicle.vehicle_photos)?.url ?? "/placeholder/no-photo.svg";
  const marketAvg = estimateValuation({
    make: vehicle.make, model: vehicle.model, year: vehicle.year, mileageKm: vehicle.mileage_km,
  }).avgEur;
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  return (
    <Link href={`/vehicle/${vehicle.id}`} className="group block">
      <Card className="max-w-full overflow-hidden ring-1 ring-grey-200 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-grey-300">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb(photo, 600)}
            alt={title}
            className={cn(
              "size-full max-w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.04]",
              state !== "live" && "opacity-90",
            )}
            loading="lazy"
          />
          <div className="absolute left-3 top-3 flex gap-2">
            {state === "live" ? (
              <Badge className={cn(
                "ring-1",
                lastDay ? "bg-warning-600 text-white ring-warning-500" : "bg-white/95 text-grey-800 ring-grey-200",
              )}>
                <CalendarClock className="mr-1 size-3" />
                {daysLeftLabel(t, listing?.end_time, now)}
              </Badge>
            ) : state === "sold" ? (
              <Badge className="bg-grey-900/90 text-white ring-1 ring-grey-800">{t("listing.sold")}</Badge>
            ) : state === "expired" ? (
              <Badge className="bg-grey-800/90 text-white ring-1 ring-grey-700">{t("listing.expired")}</Badge>
            ) : null}
          </div>
          <div className="absolute right-3 top-3">
            <WatchlistButton
              vehicleId={vehicle.id}
              initiallyWatching={isWatching}
              isAuthenticated={isAuthenticated}
              vehicleTitle={title}
              variant="icon"
            />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-bold text-grey-900">
                {title}{vehicle.trim ? ` ${vehicle.trim}` : ""}
              </h3>
              <p className="mt-0.5 truncate text-xs text-grey-500">
                {vehicle.exterior_color} · {vehicle.interior_color}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-grey-500">{t("listing.price")}</p>
              <p className="text-base font-extrabold text-grey-900 tabular-nums">{format(price ?? 0)}</p>
              <p className="mt-0.5 text-[10px] font-medium text-grey-500 tabular-nums">
                {t("listing.marketValue", { price: format(marketAvg) })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <Spec icon={Gauge}><span>{formatKm(vehicle.mileage_km, intlLocale)}</span></Spec>
            <Spec icon={Fuel}><span className="capitalize">{vehicle.fuel_type}</span></Spec>
            <Spec><span className="capitalize">{vehicle.transmission}</span></Spec>
            <Spec icon={MapPin}><span>{vehicle.location_city}</span></Spec>
          </div>

          {state === "live" ? (
            <div className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-bold text-white shadow-sm transition-colors group-hover:bg-brand-700">
              <ShoppingCart className="size-4" />
              {t("listing.buyNow")}
            </div>
          ) : (
            <div className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-grey-200 bg-grey-50 px-3 text-sm font-semibold text-grey-600">
              {state === "sold" ? t("listing.sold") : state === "expired" ? t("listing.expired") : t("common.viewDetails")}
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
