import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConditionReport } from "@/components/vehicle/ConditionReport";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { SpecsGrid } from "@/components/vehicle/SpecsGrid";
import { VehicleStatusSelect } from "@/components/admin/VehicleStatusSelect";
import { createClient } from "@/lib/supabase/server";
import { normalizeVehicleRow } from "@/lib/supabase/normalize";
import { formatEur, formatRelativeTime } from "@/lib/utils";
import type { VehicleWithMedia } from "@/types";

export const metadata = { title: "Vehicle · Admin" };

export default async function AdminVehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select(`
      *,
      vehicle_photos ( id, url, sort_order, caption, category ),
      vehicle_damages ( id, location, description, severity, photo_url ),
      auctions ( id, status, start_time, end_time, current_bid_eur, starting_price_eur, reserve_price_eur, buy_now_price_eur, bid_count, bidder_count )
    `)
    .eq("id", id)
    .single();

  if (error || !vehicle) notFound();
  const v: VehicleWithMedia = normalizeVehicleRow(vehicle as unknown as Record<string, unknown>);
  const photos = v.vehicle_photos.sort((a, b) => a.sort_order - b.sort_order).map((p) => ({ url: p.url, caption: p.caption }));
  const auction = v.auctions[0];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link
        href="/admin/vehicles"
        className="mb-6 inline-flex items-center gap-1 text-sm text-grey-500 hover:text-brand-600"
      >
        <ChevronLeft className="size-4" />
        All vehicles
      </Link>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <PhotoGallery photos={photos} alt={`${v.year} ${v.make} ${v.model}`} />

          <header>
            <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">
              {v.year} {v.make} {v.model}
            </h1>
            <p className="mt-1 text-grey-500">
              {v.exterior_color} · {v.interior_color} · {v.location_city}, {v.location_country}
            </p>
          </header>

          <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
            <h2 className="mb-4 text-lg font-bold text-grey-900">Specifications</h2>
            <SpecsGrid vehicle={v} />
          </section>

          <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
            <h2 className="mb-4 text-lg font-bold text-grey-900">Condition report</h2>
            <ConditionReport damages={v.vehicle_damages ?? []} />
          </section>

          {v.description && (
            <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <h2 className="mb-3 text-lg font-bold text-grey-900">Seller notes</h2>
              <p className="text-sm leading-relaxed text-grey-700">{v.description}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Current status</p>
            <div className="mt-2">
              <VehicleStatusSelect vehicleId={v.id} currentStatus={v.status} />
            </div>

            <dl className="mt-6 space-y-2.5 border-t border-grey-100 pt-5 text-sm">
              <Row label="Listed price" value={formatEur(v.listed_price_eur)} />
              <Row label="Reserve" value={formatEur(v.reserve_price_eur)} />
              <Row label="Buy now" value={formatEur(v.buy_now_price_eur)} />
              <Row label="Last update" value={formatRelativeTime(v.updated_at)} />
              <Row label="Seller" value={v.seller_name} />
              <Row label="Seller phone" value={v.seller_phone} />
            </dl>
          </div>

          {auction && (
            <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Auction</p>
                <Badge className="bg-warning-50 text-warning-700 ring-1 ring-warning-100 capitalize">
                  {auction.status}
                </Badge>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Current bid"   value={formatEur(auction.current_bid_eur ?? auction.starting_price_eur)} />
                <Row label="Bids"          value={`${auction.bid_count} (${auction.bidder_count} bidders)`} />
                <Row label="Ends"          value={new Date(auction.end_time).toLocaleString("en-GB")} />
              </dl>
              <Link
                href={`/auction/${auction.id}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
              >
                Open buyer auction view
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-grey-500">{label}</dt>
      <dd className="text-right font-medium text-grey-900">{value}</dd>
    </div>
  );
}
