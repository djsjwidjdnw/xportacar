import Link from "next/link";
import { ChevronRight, Car } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { VehicleStatusSelect } from "@/components/admin/VehicleStatusSelect";
import { AddVehicleButton } from "@/components/admin/AddVehicleButton";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "@/i18n/server";
import { formatEur, formatKm } from "@/lib/utils";
import type { Vehicle, VehicleStatus } from "@/types";

export const metadata = { title: "Vehicles" };

const STATUS_STYLE: Record<VehicleStatus, string> = {
  draft:                "bg-grey-100 text-grey-700 ring-grey-200",
  inspection_scheduled: "bg-grey-100 text-grey-700 ring-grey-200",
  inspected:            "bg-brand-50 text-brand-700 ring-brand-100",
  listed:               "bg-brand-50 text-brand-700 ring-brand-100",
  in_auction:           "bg-warning-50 text-warning-700 ring-warning-100",
  sold:                 "bg-success-50 text-success-700 ring-success-100",
  payment_pending:      "bg-success-50 text-success-700 ring-success-100",
  paid:                 "bg-success-50 text-success-700 ring-success-100",
  collected:            "bg-success-50 text-success-700 ring-success-100",
  shipped:              "bg-success-50 text-success-700 ring-success-100",
  delivered:            "bg-success-50 text-success-700 ring-success-100",
};

interface SearchParams { status?: VehicleStatus }

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const t = await getTranslations("admin");

  let query = supabase
    .from("vehicles")
    .select(`
      *,
      auctions ( id, status, current_bid_eur, end_time, bid_count, bidder_count )
    `)
    .order("updated_at", { ascending: false });
  if (sp.status) query = query.eq("status", sp.status);

  const { data: vehicles, error } = await query;

  // deno-lint-ignore no-explicit-any
  const list = (vehicles ?? []) as (Vehicle & { auctions: any[] })[];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">
            {t("navVehicles")}
          </h1>
          <p className="mt-1 text-grey-600">
            {list.length} vehicles across the pipeline
            {sp.status ? ` · filtered by ${sp.status}` : ""}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AddVehicleButton />
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
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Vehicle</TableHead>
                <TableHead>VIN</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Auction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((v) => {
                const auction = Array.isArray(v.auctions) ? v.auctions[0] : v.auctions;
                return (
                  <TableRow key={v.id} className="[&>td]:px-5 [&>td]:py-3.5">
                    <TableCell>
                      <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-grey-900 hover:text-brand-700">
                        {v.year} {v.make} {v.model}
                      </Link>
                      <p className="text-[11px] text-grey-500">{v.location_city} · {v.exterior_color}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-grey-600">{v.vin}</TableCell>
                    <TableCell className="text-sm text-grey-700">{formatKm(v.mileage_km)}</TableCell>
                    <TableCell className="font-semibold tabular-nums text-grey-900">
                      {formatEur(v.listed_price_eur)}
                    </TableCell>
                    <TableCell>
                      {auction ? (
                        <Link href={`/auction/${auction.id}`} className="text-xs font-medium text-brand-700 hover:underline">
                          {auction.status} · {auction.bid_count} bids
                        </Link>
                      ) : (
                        <span className="text-xs text-grey-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_STYLE[v.status]} ring-1 capitalize`}>
                        {v.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-block w-44 text-left">
                        <VehicleStatusSelect vehicleId={v.id} currentStatus={v.status} compact />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
