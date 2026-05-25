import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BidPanel } from "@/components/auction/BidPanel";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ConditionReport } from "@/components/vehicle/ConditionReport";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { SpecsGrid } from "@/components/vehicle/SpecsGrid";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { auctionPhase } from "@/lib/utils";
import type { Auction, BidWithBidder, VehicleWithMedia } from "@/types";

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations();

  const { data: auctionRow, error } = await supabase
    .from("auctions")
    .select(`
      *,
      vehicle:vehicles!vehicle_id (
        *,
        vehicle_photos ( id, url, sort_order, caption, category ),
        vehicle_damages ( id, location, description, severity, photo_url )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !auctionRow) notFound();

  const auction = auctionRow as unknown as Auction & { vehicle: VehicleWithMedia };
  const v = auction.vehicle;

  const [{ data: bidsRows }, { data: { user } }] = await Promise.all([
    supabase
      .from("bids")
      .select(`*, bidder:profiles!bidder_id(id, full_name, company_name, country, avatar_url)`)
      .eq("auction_id", auction.id)
      .order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const bids = (bidsRows ?? []) as unknown as BidWithBidder[];
  const photos = (v.vehicle_photos ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ url: p.url, caption: p.caption }));
  const vehicleTitle = `${v.year} ${v.make} ${v.model}`;
  const phase = auctionPhase(auction);

  return (
    <div className="bg-grey-50 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Breadcrumbs
          className="mb-6"
          items={[
            { href: "/marketplace", label: t("nav.marketplace") },
            { href: `/vehicle/${v.id}`, label: vehicleTitle },
            { label: "Auction" },
          ]}
        />

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <PhotoGallery photos={photos} alt={vehicleTitle} />

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
                {phase === "scheduled" && (
                  <Badge variant="outline" className="bg-white text-grey-700">{t("common.scheduled")}</Badge>
                )}
                <Badge variant="outline" className="border-grey-200 text-grey-600">
                  {v.body_type}
                </Badge>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
                {t("auction.title", { make: v.make, model: v.model })}
              </h1>
              <p className="mt-1 text-grey-500">
                {v.year} · {v.exterior_color} · {v.location_city}, {v.location_country}
              </p>
            </header>

            <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <h2 className="mb-4 text-lg font-bold text-grey-900">{t("vehicle.specs")}</h2>
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
                    <span key={f} className="inline-flex items-center rounded-md bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-100">
                      {f}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <h2 className="mb-4 text-lg font-bold text-grey-900">{t("vehicle.conditionReport")}</h2>
              <ConditionReport damages={v.vehicle_damages ?? []} />
            </section>
          </div>

          {/* Sticky bid panel */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <BidPanel
                auction={auction}
                bids={bids}
                buyNowPriceEur={auction.buy_now_price_eur ?? v.buy_now_price_eur}
                isAuthenticated={!!user}
                currentUserId={user?.id ?? null}
                vehicleTitle={vehicleTitle}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
