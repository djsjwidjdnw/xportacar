import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatEur, formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Invoices · Admin" };

export default async function AdminInvoicesPage() {
  const supabase = await createClient();

  const { data: rowsRaw } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, amount_eur, platform_fee_eur, total_eur, status, created_at, paid_at,
      buyer:profiles!buyer_id ( id, full_name, company_name, country ),
      vehicle:vehicles!vehicle_id ( id, year, make, model )
    `)
    .order("created_at", { ascending: false });
  // deno-lint-ignore no-explicit-any
  const rows = (rowsRaw ?? []) as any[];

  const totalAmount = rows.reduce((s, r) => s + Number(r.total_eur ?? 0), 0);
  const paidCount   = rows.filter((r) => r.status === "paid").length;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900">Invoices</h1>
          <p className="mt-1 text-grey-600">
            {rows.length} invoices · {paidCount} paid · {formatEur(totalAmount)} billed
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Dashboard <ChevronRight className="size-4" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-grey-300 bg-white p-16 text-center">
          <FileText className="mb-3 size-8 text-grey-400" />
          <p className="font-semibold text-grey-900">No invoices yet.</p>
          <p className="mt-1 text-sm text-grey-500">Invoices are auto-generated when an auction closes.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-grey-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-grey-50/60 [&>th]:px-5 [&>th]:py-3 [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-grey-500">
                <TableHead>Invoice</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead className="text-right">Hammer</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="[&>td]:px-5 [&>td]:py-3.5">
                  <TableCell>
                    <Link
                      href={`/admin/invoices/${r.id}`}
                      className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                    >
                      {r.invoice_number ?? r.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {r.vehicle ? (
                      <Link href={`/admin/vehicles/${r.vehicle.id}`} className="text-sm text-grey-800 hover:text-brand-700">
                        {r.vehicle.year} {r.vehicle.make} {r.vehicle.model}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-grey-900">
                      {r.buyer?.company_name ?? r.buyer?.full_name ?? "—"}
                    </p>
                    <p className="text-[11px] text-grey-500">{r.buyer?.country}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-grey-700">{formatEur(r.amount_eur)}</TableCell>
                  <TableCell className="text-right tabular-nums text-grey-700">{formatEur(r.platform_fee_eur)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-grey-900">{formatEur(r.total_eur)}</TableCell>
                  <TableCell>
                    <Badge className={r.status === "paid"
                      ? "bg-success-50 text-success-700 ring-1 ring-success-100"
                      : r.status === "cancelled"
                      ? "bg-error-50 text-error-700 ring-1 ring-error-100"
                      : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-grey-500">{formatRelativeTime(r.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
