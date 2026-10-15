import Link from "next/link";
import { ChevronRight, Car } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AddVehicleButton } from "@/components/admin/AddVehicleButton";
import { AutoAssignButton } from "@/components/admin/AutoAssignButton";
import { LoadMoreLink } from "@/components/admin/LoadMoreLink";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { formatEur, formatKm } from "@/lib/utils";
import type { Vehicle, VehicleStatus } from "@/types";

export const metadata = { title: "Vehicles" };

// Stored UAE / EU market medians (market-prices lookups), by vehicle id.
interface MarketCell { uae_median_eur: number | null; uae_status: string | null; eu_median_eur: number | null; eu_status: string | null }

const STATUS_STYLE: Record<VehicleStatus, string> = {
  draft:                "bg-grey-100 text-grey-700 ring-grey-200",
  inspection_scheduled: "bg-grey-100 text-grey-700 ring-grey-200",
  inspected:            "bg-brand-50 text-brand-700 ring-brand-100",
  pending_review:       "bg-warning-50 text-warning-700 ring-warning-600",
  changes_requested:    "bg-error-50 text-error-700 ring-error-600",
  listed:               "bg-brand-50 text-brand-700 ring-brand-100",
  in_auction:           "bg-warning-50 text-warning-700 ring-warning-100",
  sold:                 "bg-success-50 text-success-700 ring-success-100",
  payment_pending:      "bg-success-50 text-success-700 ring-success-100",
  paid:                 "bg-success-50 text-success-700 ring-success-100",
  collected:            "bg-success-50 text-success-700 ring-success-100",
  shipped:              "bg-success-50 text-success-700 ring-success-100",
  delivered:            "bg-success-50 text-success-700 ring-success-100",
};

interface SearchParams { status?: VehicleStatus; show?: string }

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations("admin");
  const show = Math.min(Math.max(Number(sp.show) || 20, 20), 5000);

  let query = supabase
    .from("vehicles")
    .select(`
      *,
      auctions ( id, status, current_bid_eur, end_time, bid_count, bidder_count )
    `)
    .order("updated_at", { ascending: false });
  if (sp.status) query = query.eq("status", sp.status);
  query = query.range(0, show - 1);

  // Total count is head-only (no rows transferred) so it scales to 100k+.
  let countQuery = supabase.from("vehicles").select("id", { count: "exact", head: true });
  if (sp.status) countQuery = countQuery.eq("status", sp.status);

  const inspectorsQuery = supabase.from("profiles").select("id, full_name, email").eq("role", "inspector");
  const [{ data: vehicles, error }, { count: totalRaw }, { data: inspectorsRaw }] = await Promise.all([query, countQuery, inspectorsQuery]);
  const total = totalRaw ?? 0;
  const inspectors = (inspectorsRaw ?? []) as { id: string; full_name: string | null; email: string | null }[];

  // deno-lint-ignore no-explicit-any
  const list = (vehicles ?? []) as (Vehicle & { auctions: any[] })[];

  const market = new Map<string, MarketCell>();
  if (list.length) {
    const { data: priceRows } = await supabase
      .from("vehicle_market_prices")
      .select("vehicle_id, uae_median_eur, uae_status, eu_median_eur, eu_status")
      .in("vehicle_id", list.map((v) => v.id));
    for (const r of (priceRows ?? []) as (MarketCell & { vehicle_id: string })[]) market.set(r.vehicle_id, r);
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">
            {t("navVehicles")}
          </h1>
          <p className="mt-1 text-grey-600">
            {total} vehicles across the pipeline
            {sp.status ? ` · filtered by ${sp.status}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AutoAssignButton />
          <AddVehicleButton inspectors={inspectors} />
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
          >
            {t("navDashboard")}
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 p-6 text-error-700">
          {error.message}
        </div>
      ) : list.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
          <Car className="mb-3 size-8 text-grey-400" />
          <p className="font-semibold text-grey-900">No vehicles match this filter.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table className="min-w-full xl:min-w-0">
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Vehicle</TableHead>
                <TableHead className="hidden 2xl:table-cell">VIN</TableHead>
                <TableHead className="hidden xl:table-cell">Mileage</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="hidden 2xl:table-cell">Market</TableHead>
                <TableHead className="hidden xl:table-cell">Auction</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((v) => {
                const auction = Array.isArray(v.auctions) ? v.auctions[0] : v.auctions;
                const m = market.get(v.id);
                const uae = m?.uae_status === "ok" && m.uae_median_eur != null ? Number(m.uae_median_eur) : null;
                const eu = m?.eu_status === "ok" && m.eu_median_eur != null ? Number(m.eu_median_eur) : null;
                return (
                  <TableRow key={v.id} className="cursor-pointer transition-colors hover:bg-grey-50 [&>td]:px-5 [&>td]:py-3.5">
                    <TableCell>
                      <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-grey-900 hover:text-brand-700">
                        {v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ""}
                      </Link>
                      <p className="text-[11px] text-grey-500">{v.location_city} · {v.exterior_color}</p>
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell max-w-[180px] truncate font-mono text-xs text-grey-600">{v.vin}</TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-grey-700">{formatKm(v.mileage_km)}</TableCell>
                    <TableCell className="tabular-nums">
                      <span className="font-semibold text-grey-900">{formatEur(v.listed_price_eur)}</span>
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell tabular-nums text-xs text-grey-600">
                      {uae == null && eu == null ? (
                        <span className="text-grey-400">—</span>
                      ) : (
                        <>
                          <span className="block">UAE {uae != null ? formatEur(uae) : "—"}</span>
                          <span className="block">EU {eu != null ? formatEur(eu) : "—"}</span>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {auction ? (
                        <Link href={`/auction/${auction.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                          {auction.status} · {auction.bid_count} bids
                        </Link>
                      ) : (
                        <span className="text-xs text-grey-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {v.status === "pending_review" ? (
                        <Badge className="gap-1 bg-warning-600 font-bold text-white ring-1 ring-warning-700">
                          <span className="inline-block size-1.5 rounded-full bg-white" /> Review
                        </Badge>
                      ) : (
                        <Badge className={`${STATUS_STYLE[v.status]} ring-1 capitalize`}>
                          {v.status.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!error && <LoadMoreLink basePath="/admin/vehicles" params={{ status: sp.status }} shown={list.length} total={total} />}
    </div>
  );
}
