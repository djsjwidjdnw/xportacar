import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ConditionReport } from "@/components/vehicle/ConditionReport";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { SpecsGrid } from "@/components/vehicle/SpecsGrid";
import { MarketValueBar } from "@/components/vehicle/MarketValueBar";
import { VehicleStatusSelect } from "@/components/admin/VehicleStatusSelect";
import { LifecycleActions } from "@/components/admin/LifecycleActions";
import { InspectorAssign } from "@/components/admin/InspectorAssign";
import { CreateAuctionButton } from "@/components/admin/CreateAuctionButton";
import { VehicleReviewPanel } from "@/components/admin/VehicleReviewPanel";
import { EditVehicleDialog } from "@/components/admin/EditVehicleDialog";
import { ReopenInspectionButton } from "@/components/admin/ReopenInspectionButton";
import { createClient } from "@/lib/supabase/server";
import { normalizeVehicleRow } from "@/lib/supabase/normalize";
import { getVehicleValuation } from "@/lib/valuation-server";
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
  const paintThicknessUrl = v.vehicle_photos.find((p) => p.category === "paint_thickness")?.url ?? null;
  const photos = v.vehicle_photos
    .filter((p) => p.category !== "paint_thickness")
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => ({ url: p.url, caption: p.caption }));
  const auction = v.auctions[0];

  const { data: inspectorsRaw } = await supabase
    .from("profiles").select("id, full_name, email").eq("role", "inspector");
  const inspectors = (inspectorsRaw ?? []) as { id: string; full_name: string | null; email: string | null }[];

  const valuation = await getVehicleValuation({
    make: v.make, model: v.model, year: v.year, mileageKm: v.mileage_km, vehicleId: v.id,
  });

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Link
        href="/admin/vehicles"
        className="mb-6 inline-flex items-center gap-1 text-sm text-grey-500 hover:text-brand-600"
      >
        <ChevronLeft className="size-4" />
        All vehicles
      </Link>

      {(v.status === "pending_review" || v.status === "changes_requested") && (
        <div className="mb-6 space-y-4">
          {v.status === "pending_review" && (
            <div className="rounded-xl border-l-4 border-warning-600 bg-warning-50 px-5 py-4">
              <p className="font-bold text-grey-900">Awaiting your review</p>
              <p className="mt-0.5 text-sm text-grey-600">
                The inspector submitted this vehicle for listing. Review the full report below (photos,
                condition, pricing, market valuation), then approve, request changes, or edit &amp; list.
              </p>
            </div>
          )}
          {v.status === "changes_requested" && (
            <div className="rounded-xl border-l-4 border-error-600 bg-error-50 px-5 py-4">
              <p className="font-bold text-grey-900">Changes requested — sent back to the inspector</p>
              {v.review_notes
                ? <p className="mt-1 text-sm text-grey-700">“{v.review_notes}”</p>
                : <p className="mt-1 text-sm text-grey-600">Waiting for the inspector to re-submit.</p>}
            </div>
          )}
          <VehicleReviewPanel
            vehicleId={v.id}
            listedPriceEur={v.listed_price_eur}
            reservePriceEur={v.reserve_price_eur}
            buyNowPriceEur={v.buy_now_price_eur}
            description={v.description}
          />
        </div>
      )}

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
            <ConditionReport
              damages={v.vehicle_damages ?? []}
              photos={photos}
              inspectionNotes={v.inspection_notes}
              inspectionDate={v.inspection_date}
              paintThicknessUrl={paintThicknessUrl}
            />
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
            <div className="mb-4">
              <EditVehicleDialog
                vehicleId={v.id}
                vehicle={{
                  vin: v.vin, make: v.make, model: v.model, year: v.year, mileage_km: v.mileage_km,
                  fuel_type: v.fuel_type, transmission: v.transmission,
                  drivetrain: v.drivetrain, engine: v.engine, body_type: v.body_type,
                  market_spec: v.market_spec, exterior_color: v.exterior_color, interior_color: v.interior_color,
                  location_city: v.location_city, location_country: v.location_country,
                  inspection_notes: v.inspection_notes,
                  listed_price_eur: v.listed_price_eur, reserve_price_eur: v.reserve_price_eur,
                  buy_now_price_eur: v.buy_now_price_eur, status: v.status,
                }}
                auction={auction ? { id: auction.id, end_time: auction.end_time } : null}
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Current status</p>
            <div className="mt-2">
              <VehicleStatusSelect vehicleId={v.id} currentStatus={v.status} />
            </div>

            {["sold", "picked_up", "in_transit", "delivered"].includes(v.status) && (
              <LifecycleActions vehicleId={v.id} currentStatus={v.status} />
            )}

            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-grey-500">Assigned inspector</p>
            <div className="mt-2">
              <InspectorAssign
                vehicleId={v.id}
                currentInspectorId={v.inspector_id ?? null}
                inspectors={inspectors}
              />
            </div>

            {/* Admin actions — STATUS-INDEPENDENT by design.
                "Create auction" shows whenever no auction row exists yet, for ANY
                vehicle status (createAuctionAction upserts on vehicle_id and has
                no status gate, so it's safe from any status). "Re-open
                inspection" is ALWAYS available — an admin can send the vehicle
                back to the inspector for revisions at any point, regardless of
                status or whether an auction exists (reopenInspectionAction also
                has no status gate). Vehicle status no longer hides either button. */}
            <div className="mt-5 border-t border-grey-100 pt-5">
              {!auction && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-500">Create auction</p>
                  <CreateAuctionButton
                    vehicleId={v.id}
                    listedPriceEur={v.listed_price_eur}
                    reservePriceEur={v.reserve_price_eur}
                    buyNowPriceEur={v.buy_now_price_eur}
                  />
                </>
              )}
              <ReopenInspectionButton vehicleId={v.id} />
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

          <MarketValueBar valuation={valuation} priceEur={v.listed_price_eur} title="Market valuation" priceLabel="Listed" />

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
              {/* Once an auction exists the create button is replaced by an
                  edit affordance. Only offer it before any bids land — the
                  create action UPSERTs on vehicle_id, so editing after bids
                  would reset the live auction. */}
              {auction.bid_count === 0 && (
                <div className="mt-4 border-t border-grey-100 pt-4">
                  <CreateAuctionButton
                    vehicleId={v.id}
                    listedPriceEur={auction.starting_price_eur}
                    reservePriceEur={auction.reserve_price_eur}
                    buyNowPriceEur={auction.buy_now_price_eur}
                    variant="outline"
                    label="Edit auction"
                  />
                </div>
              )}
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
