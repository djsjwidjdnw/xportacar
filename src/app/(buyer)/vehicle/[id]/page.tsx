import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConditionReport } from "@/components/vehicle/ConditionReport";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { ShippingEstimator } from "@/components/vehicle/ShippingEstimator";
import { SpecsGrid } from "@/components/vehicle/SpecsGrid";
import { WatchlistButton } from "@/components/marketplace/WatchlistButton";
import { createClient } from "@/lib/supabase/server";
import { normalizeVehicleRow } from "@/lib/supabase/normalize";
import { getTranslations } from "@/i18n/server";
import { cn, formatEur } from "@/lib/utils";
import type { VehicleWithMedia } from "@/types";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations();

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select(`
      *,
      vehicle_photos ( id, url, sort_order, caption, category ),
      vehicle_damages ( id, location, description, severity, photo_url ),
      auctions ( id, status, end_time, current_bid_eur, starting_price_eur, bid_count, bidder_count )
    `)
    .eq("id", id)
    .single();

  if (error || !vehicle) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  let watching = false;
  if (user) {
    const { data: w } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("vehicle_id", id)
      .maybeSingle();
    watching = !!w;
  }

  const v: VehicleWithMedia = normalizeVehicleRow(vehicle as unknown as Record<string, unknown>);
  const photos = v.vehicle_photos
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ url: p.url, caption: p.caption }));
  const auction = v.auctions[0];
  const headlinePrice = auction?.status === "active"
    ? (auction.current_bid_eur ?? auction.starting_price_eur)
    : v.listed_price_eur;

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb / back */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link href="/marketplace" className="text-grey-500 hover:text-brand-600">
            ← {t("nav.marketplace")}
          </Link>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Gallery + main info */}
          <div className="lg:col-span-8 space-y-8">
            <PhotoGallery photos={photos} alt={`${v.year} ${v.make} ${v.model}`} />

            <header>
              <div className="flex items-center gap-2">
                {auction?.status === "active" && (
                  <Badge className="bg-error-50 text-error-700 ring-1 ring-error-100">
                    <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-error-600" />
                    {t("common.live")}
                  </Badge>
                )}
                <Badge variant="outline" className="border-grey-200 text-grey-600">
                  {v.body_type}
                </Badge>
                <span className="inline-flex items-center gap-1 text-sm text-grey-500">
                  <MapPin className="size-3.5" />
                  {v.location_city}, {v.location_country}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
                {v.year} {v.make} {v.model}
              </h1>
              <p className="mt-1 text-grey-500">
                {v.exterior_color} · {v.interior_color}
              </p>
            </header>

            <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <h2 className="mb-4 text-lg font-bold text-grey-900">
                {t("vehicle.specs")}
              </h2>
              <SpecsGrid vehicle={v} />
            </section>

            {v.features && v.features.length > 0 && (
              <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-grey-900">
                  <Sparkles className="size-5 text-brand-600" />
                  {t("vehicle.features")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {v.features.map((f: string) => (
                    <span
                      key={f}
                      className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <h2 className="mb-4 text-lg font-bold text-grey-900">
                {t("vehicle.conditionReport")}
              </h2>
              <ConditionReport damages={v.vehicle_damages ?? []} />
            </section>

            <ShippingEstimator vehicleId={v.id} />

            {v.description && (
              <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
                <h2 className="mb-3 text-lg font-bold text-grey-900">
                  {t("vehicle.description")}
                </h2>
                <p className="text-sm leading-relaxed text-grey-700">{v.description}</p>
              </section>
            )}
          </div>

          {/* Sticky right rail */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">
                  {auction?.status === "active" ? t("common.currentBid") : t("common.startingPrice")}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-grey-900">
                  {formatEur(headlinePrice ?? 0)}
                </p>

                {auction && (
                  <p className="mt-1 text-sm text-grey-500">
                    {auction.bid_count} {t("common.bids")} · {auction.bidder_count} {t("common.bidders")}
                  </p>
                )}

                {auction ? (
                  <Link
                    href={`/auction/${auction.id}`}
                    className={cn(
                      buttonVariants({ variant: "default", size: "lg" }),
                      "mt-5 h-12 w-full text-base",
                    )}
                  >
                    {t("common.viewAuction")}
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <Link
                    href="/marketplace"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "mt-5 h-12 w-full text-base",
                    )}
                  >
                    {t("common.back")}
                  </Link>
                )}

                <div className="mt-2">
                  <WatchlistButton
                    vehicleId={v.id}
                    initiallyWatching={watching}
                    isAuthenticated={!!user}
                    vehicleTitle={`${v.year} ${v.make} ${v.model}`}
                    variant="full"
                  />
                </div>

                <dl className="mt-6 space-y-2.5 border-t border-grey-100 pt-5 text-sm">
                  {v.buy_now_price_eur != null && (
                    <Row label={t("common.buyNow")} value={formatEur(v.buy_now_price_eur)} />
                  )}
                  {v.reserve_price_eur != null && (
                    <Row label="Reserve" value={formatEur(v.reserve_price_eur)} />
                  )}
                  <Row label={t("vehicle.location")} value={`${v.location_city}, ${v.location_country}`} />
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </div>
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
