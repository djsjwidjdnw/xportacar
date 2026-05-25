import Link from "next/link";
import { Gavel, ExternalLink, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { LoadMoreLink } from "@/components/admin/LoadMoreLink";
import { createClient } from "@/lib/supabase/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";
import type { AuctionStatus } from "@/types";

export const metadata = { title: "Auctions · Admin" };

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all",       label: "All statuses" },
  { value: "scheduled", label: "Scheduled" },
  { value: "active",    label: "Active" },
  { value: "ended",     label: "Ended" },
  { value: "sold",      label: "Sold" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE: Record<AuctionStatus, string> = {
  scheduled: "bg-brand-50 text-brand-700 ring-brand-100",
  active:    "bg-success-50 text-success-700 ring-success-100",
  ended:     "bg-grey-100 text-grey-700 ring-grey-200",
  sold:      "bg-warning-50 text-warning-700 ring-warning-100",
  cancelled: "bg-error-50 text-error-700 ring-error-100",
};

interface SearchParams { status?: string; show?: string }

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const show = Math.min(Math.max(Number(sp.show) || 20, 20), 5000);
  const statusFilter = sp.status && sp.status !== "all" ? sp.status : null;

  let query = supabase
    .from("auctions")
    .select(`
      id, status, start_time, end_time, starting_price_eur, current_bid_eur,
      buy_now_price_eur, reserve_price_eur, bid_count, bidder_count, winner_id,
      vehicle:vehicles!vehicle_id ( id, year, make, model, vin, location_city ),
      winner:profiles!winner_id ( id, full_name, company_name, email )
    `)
    .order("end_time", { ascending: false });

  if (statusFilter) query = query.eq("status", statusFilter);
  query = query.range(0, show - 1);

  // Per-status counts via head-only queries (indexed on auctions.status) so we
  // never scan the whole table just to render the filter chips.
  const STATUSES = ["scheduled", "active", "ended", "sold", "cancelled"] as const;
  const [{ data: rowsRaw }, allCount, ...statusCounts] = await Promise.all([
    query,
    supabase.from("auctions").select("id", { count: "exact", head: true }),
    ...STATUSES.map((s) => supabase.from("auctions").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  // deno-lint-ignore no-explicit-any
  const rows = (rowsRaw ?? []) as any[];

  const countByStatus: Record<string, number> = { all: allCount.count ?? 0 };
  STATUSES.forEach((s, i) => { countByStatus[s] = statusCounts[i].count ?? 0; });
  const total = statusFilter ? (countByStatus[statusFilter] ?? 0) : countByStatus.all;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: "Auctions" }]} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Gavel className="size-5" />
            </span>
            Auctions
          </h1>
          <p className="mt-2 text-grey-600">
            {total} {statusFilter ? `${statusFilter} ` : ""}auctions
          </p>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-grey-400" />
        {STATUS_OPTIONS.map((opt) => {
          const active = (sp.status ?? "all") === opt.value;
          const count = countByStatus[opt.value] ?? 0;
          return (
            <Link
              key={opt.value}
              href={opt.value === "all" ? "/admin/auctions" : `/admin/auctions?status=${opt.value}`}
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
                (active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-grey-200 bg-white text-grey-700 hover:border-grey-300")
              }
            >
              {opt.label}
              <span className={
                "rounded-full px-1.5 text-[10px] " +
                (active ? "bg-white/20 text-white" : "bg-grey-100 text-grey-600")
              }>{count}</span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead className="text-right">Start price</TableHead>
              <TableHead className="text-right">Current bid</TableHead>
              <TableHead className="text-right">Bids</TableHead>
              <TableHead>Winner</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="px-5 py-12 text-center text-grey-500">
                  No auctions match this filter.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => {
              const v = a.vehicle;
              const w = a.winner;
              return (
                <TableRow key={a.id} className="[&>td]:px-5 [&>td]:py-3.5">
                  <TableCell>
                    {v ? (
                      <Link
                        href={`/admin/vehicles/${v.id}`}
                        className="block font-medium text-grey-900 hover:text-brand-700"
                      >
                        {v.year} {v.make} {v.model}
                      </Link>
                    ) : "—"}
                    {v && <p className="text-[11px] text-grey-500">{v.location_city} · {v.vin}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_STYLE[a.status as AuctionStatus] ?? "bg-grey-100 text-grey-700 ring-grey-200"} ring-1 capitalize`}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-grey-600">
                    {a.start_time ? formatRelativeTime(a.start_time) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-grey-600">
                    {a.end_time ? formatRelativeTime(a.end_time) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-grey-700">
                    {formatEur(a.starting_price_eur)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-grey-900">
                    {formatEur(a.current_bid_eur)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className="font-semibold text-grey-900">{a.bid_count ?? 0}</span>
                    <span className="ml-1 text-[11px] text-grey-500">/ {a.bidder_count ?? 0} bidders</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {w ? (
                      <span className="font-medium text-grey-900">
                        {w.company_name ?? w.full_name ?? w.email}
                      </span>
                    ) : (
                      <span className="text-grey-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/auction/${a.id}`}
                      aria-label="View auction"
                      className="grid size-7 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-brand-700"
                    >
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <LoadMoreLink basePath="/admin/auctions" params={{ status: sp.status }} shown={rows.length} total={total} />
    </div>
  );
}
