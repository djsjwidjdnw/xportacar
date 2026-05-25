"use client";

// Right-rail sticky price card on the vehicle detail page.
// Lives client-side so the currency selector can update its prices live and
// the card flips to its ended state the moment end_time passes.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { useTranslations } from "@/i18n/provider";
import { useCurrency } from "@/lib/currency";
import { auctionPhase, cn } from "@/lib/utils";

export function VehiclePriceCard({
  auction,
  headlinePriceEur,
  buyNowPriceEur,
  reservePriceEur,
  locationCity,
  locationCountry,
}: {
  auction: {
    id: string;
    status: string;
    start_time?: string | null;
    end_time?: string | null;
    bid_count: number;
    bidder_count: number;
  } | null;
  headlinePriceEur: number | null;
  buyNowPriceEur: number | null;
  reservePriceEur: number | null;
  locationCity: string;
  locationCountry: string;
}) {
  const t = useTranslations();
  const { format } = useCurrency();

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

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">
          {ended ? t("common.ended") : live ? t("common.currentBid") : t("common.startingPrice")}
        </p>
        <CurrencyPills />
      </div>
      <p className="mt-1 text-3xl font-extrabold text-grey-900 tabular-nums">
        {format(headlinePriceEur ?? 0)}
      </p>

      {auction && (
        <p className="mt-1 text-sm text-grey-500">
          {auction.bid_count} {t("common.bids")} · {auction.bidder_count} {t("common.bidders")}
        </p>
      )}

      {auction ? (
        <div className="mt-5 flex flex-col gap-2">
          {live && (
            <Link
              href={`/auction/${auction.id}`}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 w-full justify-center text-base font-bold",
              )}
            >
              {t("common.bidNow")}
              <ArrowRight className="size-4" />
            </Link>
          )}
          {!live && (
            <Link
              href={`/auction/${auction.id}`}
              className={cn(
                buttonVariants({ variant: ended ? "outline" : "default", size: "lg" }),
                "h-12 w-full justify-center text-base",
              )}
            >
              {ended ? t("common.viewResult") : t("common.viewAuction")}
              <ArrowRight className="size-4" />
            </Link>
          )}
          {/* Buy Now is only available while the auction is live. */}
          {buyNowPriceEur != null && live && (
            <Link
              href={`/auction/${auction.id}?buyNow=1`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 w-full justify-center text-base font-bold",
              )}
            >
              {t("common.buyNow")} {format(buyNowPriceEur)}
            </Link>
          )}
        </div>
      ) : (
        <Link
          href="/marketplace"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-5 h-12 w-full justify-center text-base",
          )}
        >
          {t("common.back")}
        </Link>
      )}

      <dl className="mt-6 space-y-2.5 border-t border-grey-100 pt-5 text-sm">
        {buyNowPriceEur != null && !ended && (
          <Row label={t("common.buyNow")} value={format(buyNowPriceEur)} />
        )}
        {reservePriceEur != null && (
          <Row label="Reserve" value={format(reservePriceEur)} />
        )}
        <Row label={t("vehicle.location")} value={`${locationCity}, ${locationCountry}`} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-grey-500">{label}</dt>
      <dd className="font-medium text-grey-900">{value}</dd>
    </div>
  );
}
