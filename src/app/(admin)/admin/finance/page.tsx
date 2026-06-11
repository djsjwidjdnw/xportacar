import Link from "next/link";
import { BadgeDollarSign, TrendingUp, Wallet, FileText, Clock, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { StatCard } from "@/components/admin/StatCard";
import { createClient } from "@/lib/supabase/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Finance · Admin" };

export default async function AdminFinancePage() {
  const supabase = await createClient();

  // Sold auctions → realised revenue.  Hammer + platform fee is what
  // ended up on an invoice. We pull straight from invoices to stay in
  // sync with the invoice numbers shown below.
  const { data: invoicesRaw } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, amount_eur, platform_fee_eur, total_eur,
      status, created_at, paid_at,
      buyer:profiles!buyer_id ( id, full_name, company_name, email ),
      vehicle:vehicles!vehicle_id ( id, year, make, model )
    `)
    .order("created_at", { ascending: false });

  // deno-lint-ignore no-explicit-any
  const invoices = (invoicesRaw ?? []) as any[];

  const paidInvoices    = invoices.filter((i) => i.status === "paid");
  const pendingInvoices = invoices.filter((i) => i.status === "pending");

  const totalRevenue        = paidInvoices.reduce((s, i) => s + Number(i.total_eur ?? 0), 0);
  const platformFeesEarned  = paidInvoices.reduce((s, i) => s + Number(i.platform_fee_eur ?? 0), 0);
  const outstandingValue    = pendingInvoices.reduce((s, i) => s + Number(i.total_eur ?? 0), 0);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Breadcrumbs className="mb-5" items={[{ label: "Finance" }]} />
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-grey-900">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <BadgeDollarSign className="size-5" />
          </span>
          Finance
        </h1>
        <p className="mt-2 text-grey-600">Revenue, fees, and the live invoice ledger.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatEur(totalRevenue)}
          iconName="badge-euro"
          accent="success"
          delta={{ value: `${paidInvoices.length} paid`, positive: true }}
        />
        <StatCard
          label="Platform fees"
          value={formatEur(platformFeesEarned)}
          iconName="badge-euro"
          accent="brand"
          delta={{ value: "2.9% of hammer", positive: true }}
        />
        <StatCard
          label="Outstanding invoices"
          value={formatEur(outstandingValue)}
          iconName="gavel"
          accent="warning"
          delta={{ value: `${pendingInvoices.length} pending`, positive: false }}
        />
        <StatCard
          label="Total invoices"
          value={String(invoices.length)}
          iconName="users"
          accent="brand"
        />
      </section>

      <section className="mt-10">
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <header className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-grey-500" />
              <h2 className="text-lg font-bold text-grey-900">Invoices</h2>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 font-semibold text-success-700">
                <Wallet className="size-3" />
                {paidInvoices.length} paid
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 font-semibold text-warning-700">
                <Clock className="size-3" />
                {pendingInvoices.length} pending
              </span>
            </div>
          </header>
          <div className="border-t border-grey-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                  <TableHead>Invoice #</TableHead>
                  <TableHead className="hidden xl:table-cell">Buyer</TableHead>
                  <TableHead className="hidden xl:table-cell">Vehicle</TableHead>
                  <TableHead className="hidden 2xl:table-cell text-right">Amount</TableHead>
                  <TableHead className="hidden 2xl:table-cell text-right">Platform fee</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="px-5 py-12 text-center text-grey-500">
                      <TrendingUp className="mx-auto mb-2 size-7 text-grey-300" />
                      No invoices yet. They&apos;re auto-generated when an auction is marked sold.
                    </TableCell>
                  </TableRow>
                )}
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="[&>td]:px-5 [&>td]:py-3.5">
                    <TableCell>
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                      >
                        {inv.invoice_number ?? inv.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">
                      <p className="max-w-[180px] truncate font-medium text-grey-900">
                        {inv.buyer?.company_name ?? inv.buyer?.full_name ?? "—"}
                      </p>
                      <p className="max-w-[180px] truncate text-[11px] text-grey-500">{inv.buyer?.email}</p>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[180px] truncate text-sm text-grey-700">
                      {inv.vehicle
                        ? `${inv.vehicle.year} ${inv.vehicle.make} ${inv.vehicle.model}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell text-right tabular-nums text-grey-700">
                      {formatEur(inv.amount_eur)}
                    </TableCell>
                    <TableCell className="hidden 2xl:table-cell text-right tabular-nums text-brand-700">
                      {formatEur(inv.platform_fee_eur)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-grey-900">
                      {formatEur(inv.total_eur)}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        inv.status === "paid"
                          ? "bg-success-50 text-success-700 ring-1 ring-success-100 capitalize"
                          : inv.status === "cancelled"
                          ? "bg-error-50 text-error-700 ring-1 ring-error-100 capitalize"
                          : "bg-warning-50 text-warning-700 ring-1 ring-warning-100 capitalize"
                      }>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-grey-600">
                      {formatRelativeTime(inv.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        aria-label="View invoice"
                        className="grid size-7 place-items-center rounded-md text-grey-400 transition-colors hover:bg-grey-100 hover:text-brand-700"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}
