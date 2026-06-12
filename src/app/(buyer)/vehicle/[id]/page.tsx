import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Gavel, Hourglass, MapPin, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ConditionReport } from "@/components/vehicle/ConditionReport";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { ShippingOptions } from "@/components/vehicle/ShippingOptions";
import { MarketValueBar } from "@/components/vehicle/MarketValueBar";
import { PaintThicknessReport } from "@/components/vehicle/PaintThicknessReport";
import { SpecsGrid } from "@/components/vehicle/SpecsGrid";
import { VehiclePriceCard } from "@/components/vehicle/VehiclePriceCard";
import { WatchlistButton } from "@/components/marketplace/WatchlistButton";
import { createClient } from "@/lib/supabase/server";
import { normalizeVehicleRow } from "@/lib/supabase/normalize";
import { getTranslations } from "@/i18n/server";
import { getVehicleValuation } from "@/lib/valuation-server";
import { auctionPhase, cn, formatEur, pickThumbnailPhoto } from "@/lib/utils";
import type { VehicleWithMedia } from "@/types";

// Generate OG/Twitter metadata per vehicle so shared links render with
// the car's photo + title + asking price.
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select(`
      year, make, model, trim, location_city, location_country, listed_price_eur,
      vehicle_photos ( url, sort_order )
    `)
    .eq("id", id)
    .single();
  if (!data) return { title: "Vehicle not found" };
  // deno-lint-ignore no-explicit-any
  const v = data as any;
  const photo = (v.vehicle_photos ?? [])
    .slice()
    .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)[0];
  const title = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
  const description = [
    `${v.year} ${v.make} ${v.model} — auctioned from ${v.location_city}, ${v.location_country}.`,
    v.listed_price_eur ? `Listed from €${Number(v.listed_price_eur).toLocaleString("en-GB")}.` : "",
    "Inspected by XportACar's UAE field team and shipped door-to-port across the EU.",
  ].filter(Boolean).join(" ");

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      images: photo ? [{ url: photo.url, width: 1200, height: 800, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: photo ? [photo.url] : undefined,
    },
  };
}

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
      auctions ( id, status, start_time, end_time, current_bid_eur, starting_price_eur, bid_count, bidder_count )
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

  // Paint-thickness gauge readings, ordered front-to-back by canonical panel.
  const PAINT_PANEL_ORDER = [
    "front_bumper", "hood", "front_left_fender", "front_right_fender",
    "front_left_door", "front_right_door", "rear_left_door", "rear_right_door",
    "trunk", "roof",
  ];
  const { data: paintRows } = await supabase
    .from("paint_thickness_readings")
    .select("panel, reading_microns, photo_url, notes, created_at")
    .eq("vehicle_id", id);
  const paintReadings = (paintRows ?? [])
    .map((r) => ({
      panel: r.panel as string,
      reading_microns: Number(r.reading_microns),
      photo_url: (r.photo_url as string | null) ?? null,
      notes: (r.notes as string | null) ?? null,
    }))
    .sort((a, b) => {
      const ia = PAINT_PANEL_ORDER.indexOf(a.panel);
      const ib = PAINT_PANEL_ORDER.indexOf(b.panel);
      // Unknown panels sort to the end, preserving relative order.
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

  const v: VehicleWithMedia = normalizeVehicleRow(vehicle as unknown as Record<string, unknown>);
  const paintThicknessUrl =
    v.vehicle_photos.find((p) => p.category === "paint_thickness")?.url ?? null;
  const galleryPhotos = v.vehicle_photos
    .filter((p) => p.category !== "paint_thickness")
    .sort((a, b) => a.sort_order - b.sort_order);
  // Lead the gallery with the front-right 3/4 exterior shot so the hero
  // matches the marketplace thumbnail framing; keep the rest in order.
  const lead = pickThumbnailPhoto(galleryPhotos);
  const photos = (lead
    ? [lead, ...galleryPhotos.filter((p) => p !== lead)]
    : galleryPhotos
  ).map((p) => ({ url: p.url, caption: p.caption }));
  const auction = v.auctions[0];
  const phase = auctionPhase(auction);
  const auctionLive = phase === "live";
  const headlinePrice = phase === "live" || phase === "ended"
    ? (auction.current_bid_eur ?? auction.starting_price_eur)
    : v.listed_price_eur;

  const valuation = await getVehicleValuation({
    make: v.make, model: v.model, year: v.year, mileageKm: v.mileage_km, vehicleId: v.id,
  });

  // JSON-LD Vehicle structured data — Google enriches listings with
  // mileage / fuel / price when this is present.
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Vehicle",
    name: `${v.year} ${v.make} ${v.model}`,
    brand:  { "@type": "Brand", name: v.make },
    model:  v.model,
    vehicleIdentificationNumber: v.vin,
    modelDate: v.year,
    bodyType: v.body_type ?? undefined,
    fuelType: v.fuel_type,
    vehicleTransmission: v.transmission,
    color: v.exterior_color ?? undefined,
    mileageFromOdometer: v.mileage_km ? { "@type": "QuantitativeValue", value: v.mileage_km, unitCode: "KMT" } : undefined,
    image: photos.map((p) => p.url),
    offers: headlinePrice
      ? {
          "@type": "Offer",
          priceCurrency: "EUR",
          price: headlinePrice,
          itemCondition: "https://schema.org/UsedCondition",
          availability: auctionLive ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
          seller: { "@type": "Organization", name: "XportACar" },
          areaServed: ["Germany", "Netherlands", "Italy", "Spain", "France", "Austria", "Belgium"],
        }
      : undefined,
  };

  return (
    <div className="bg-grey-50 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Breadcrumbs
          className="mb-6"
          items={[
            { href: "/marketplace", label: t("nav.marketplace") },
            { label: `${v.year} ${v.make} ${v.model}` },
          ]}
        />

        {/* Above-the-fold CTA — visible before the user scrolls.
            Auction live → current bid + "Go to Auction" button.
            Auction scheduled → "Coming soon" notice.
            Listed only → "View auction" disabled link. */}
        {auctionLive && auction && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-error-200 bg-error-50/70 p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-4">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-error-600 text-white">
                <Gavel className="size-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-error-700">
                  <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-error-600 align-middle" />
                  Auction live · {auction.bid_count} bids
                </p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums text-grey-900">
                  {t("common.currentBid")}: {formatEur(headlinePrice ?? 0)}
                </p>
              </div>
            </div>
            <Link
              href={`/auction/${auction.id}`}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "h-12 gap-2 px-6 text-base shadow-sm",
              )}
            >
              {t("common.viewAuction")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
        {phase === "scheduled" && auction && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warning-200 bg-warning-50/70 p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <Hourglass className="size-5 text-warning-700" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-warning-700">Auction coming soon</p>
                <p className="text-sm text-warning-800/90">
                  Listed price {formatEur(v.listed_price_eur ?? 0)}
                  {auction.start_time ? ` · starts ${new Date(auction.start_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                </p>
              </div>
            </div>
          </div>
        )}
        {phase === "ended" && auction && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-grey-200 bg-grey-100 p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-grey-800 text-white">
                <Gavel className="size-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-grey-600">{t("common.ended")}</p>
                <p className="mt-0.5 text-sm text-grey-700">
                  {t("common.currentBid")}: {formatEur(headlinePrice ?? 0)} · {auction.bid_count} {t("common.bids")}
                </p>
              </div>
            </div>
            <Link
              href={`/auction/${auction.id}`}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 gap-2 px-6 text-base")}
            >
              {t("common.viewResult")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Gallery + main info */}
          <div className="lg:col-span-8 space-y-8">
            <PhotoGallery photos={photos} alt={`${v.year} ${v.make} ${v.model}`} />

            <header>
              <div className="flex items-center gap-2">
                {phase === "live" && (
                  <Badge className="bg-error-50 text-error-700 ring-1 ring-error-100">
                    <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-error-600" />
                    {t("common.live")}
                  </Badge>
                )}
                {phase === "ended" && (
                  <Badge className="bg-grey-800 text-white">{t("common.ended")}</Badge>
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
                {v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ""}
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
              <ConditionReport
                damages={v.vehicle_damages ?? []}
                photos={photos}
                inspectionNotes={v.inspection_notes}
                inspectionDate={v.inspection_date}
                paintThicknessUrl={paintThicknessUrl}
              />
            </section>

            <PaintThicknessReport readings={paintReadings} />

            <MarketValueBar valuation={valuation} priceEur={headlinePrice ?? v.listed_price_eur} />

            <ShippingOptions vehicleId={v.id} vehiclePriceEur={headlinePrice ?? null} />

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
            <div className="lg:sticky lg:top-24 space-y-3">
              <VehiclePriceCard
                auction={auction ? {
                  id: auction.id,
                  status: auction.status,
                  start_time: auction.start_time,
                  end_time: auction.end_time,
                  bid_count: auction.bid_count,
                  bidder_count: auction.bidder_count,
                } : null}
                headlinePriceEur={headlinePrice ?? null}
                buyNowPriceEur={v.buy_now_price_eur}
                reservePriceEur={v.reserve_price_eur}
                locationCity={v.location_city}
                locationCountry={v.location_country}
              />
              <WatchlistButton
                vehicleId={v.id}
                initiallyWatching={watching}
                isAuthenticated={!!user}
                vehicleTitle={`${v.year} ${v.make} ${v.model}`}
                variant="full"
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
