import Link from "next/link";
import { ChevronRight, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CounterOfferActions } from "@/components/admin/CounterOfferActions";
import { createClient } from "@/lib/supabase/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Counter offers · Admin" };

export default async function AdminCounterOffersPage() {
  const supabase = await createClient();

  const { data: rowsRaw } = await supabase
    .from("counter_offers")
    .select(`
      id, amount_eur, status, message, created_at, expires_at,
      bidder:profiles!bidder_id ( id, full_name, company_name, country ),
      auction:auctions!auction_id (
        id, current_bid_eur, end_time,
        vehicle:vehicles!vehicle_id ( id, year, make, model )
      )
    `)
    .order("created_at", { ascending: false });

  // deno-lint-ignore no-explicit-any
  const rows = (rowsRaw ?? []) as any[];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">
            Counter offers
          </h1>
          <p className="mt-1 text-grey-600">
            {rows.length} offers · {rows.filter((r) => r.status === "pending").length} pending review
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Back to dashboard
          <ChevronRight className="size-4" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
          <MessageSquare className="mb-3 size-8 text-grey-400" />
          <p className="font-semibold text-grey-900">No counter offers yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Vehicle</TableHead>
                <TableHead>Bidder</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Current bid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const v = r.auction?.vehicle;
                return (
                  <TableRow key={r.id} className="[&>td]:px-5 [&>td]:py-3.5 align-top">
                    <TableCell>
                      {v ? (
                        <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-grey-900 hover:text-brand-700">
                          {v.year} {v.make} {v.model}
                        </Link>
                      ) : "—"}
                      {r.message && (
                        <p className="mt-1 max-w-md text-xs text-grey-500 italic">&ldquo;{r.message}&rdquo;</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-grey-900">
                        {r.bidder?.company_name ?? r.bidder?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-grey-500">{r.bidder?.country}</p>
                    </TableCell>
                    <TableCell className="font-semibold tabular-nums text-grey-900">
                      {formatEur(r.amount_eur)}
                    </TableCell>
                    <TableCell className="tabular-nums text-grey-700">
                      {formatEur(r.auction?.current_bid_eur ?? 0)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={{
                          pending:  "bg-warning-50 text-warning-700 ring-1 ring-warning-100",
                          accepted: "bg-success-50 text-success-700 ring-1 ring-success-100",
                          rejected: "bg-error-50 text-error-700 ring-1 ring-error-100",
                          expired:  "bg-grey-100 text-grey-600 ring-1 ring-grey-200",
                        }[r.status as "pending" | "accepted" | "rejected" | "expired"] ?? ""}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-grey-500">{formatRelativeTime(r.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <CounterOfferActions offerId={r.id} status={r.status} />
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
