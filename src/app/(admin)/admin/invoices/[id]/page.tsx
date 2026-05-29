import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Printer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { InvoicePrintTrigger } from "@/components/admin/InvoicePrintTrigger";
import { CustomsDisclaimer } from "@/components/shared/CustomsDisclaimer";
import { createClient } from "@/lib/supabase/server";
import { formatEur } from "@/lib/utils";

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, amount_eur, platform_fee_eur, total_eur, status, created_at, paid_at,
      buyer:profiles!buyer_id ( id, full_name, company_name, country, email, phone, company_registration ),
      vehicle:vehicles!vehicle_id ( id, year, make, model, vin, exterior_color, mileage_km ),
      auction:auctions!auction_id ( id, end_time )
    `)
    .eq("id", id)
    .single();

  if (!invoice) notFound();
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:p-0">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-1 text-sm text-grey-500 hover:text-brand-600"
        >
          <ChevronLeft className="size-4" /> All invoices
        </Link>
        <InvoicePrintTrigger />
      </header>

      <article
        id="invoice-print"
        className="mx-auto max-w-3xl rounded-2xl border border-grey-200 bg-white p-8 shadow-xs print:border-0 print:shadow-none print:p-0"
      >
        <header className="flex items-start justify-between gap-6 border-b border-grey-100 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">XportACar</p>
            <p className="mt-2 text-xs text-grey-500">UAE-to-EU vehicle auctions<br />Dubai, United Arab Emirates</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-extrabold text-grey-900">INVOICE</h1>
            <p className="mt-1 font-mono text-xs font-semibold text-grey-700">
              {inv.invoice_number ?? inv.id.slice(0, 8)}
            </p>
            <Badge className={`mt-2 capitalize ${inv.status === "paid"
              ? "bg-success-50 text-success-700 ring-1 ring-success-100"
              : "bg-warning-50 text-warning-700 ring-1 ring-warning-100"}`}>
              {inv.status}
            </Badge>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Bill to</p>
            <p className="mt-2 font-semibold text-grey-900">
              {inv.buyer?.company_name ?? inv.buyer?.full_name ?? "—"}
            </p>
            <p className="text-grey-600">{inv.buyer?.country}</p>
            <p className="text-grey-600">{inv.buyer?.email}</p>
            <p className="text-grey-600">{inv.buyer?.phone}</p>
            {inv.buyer?.company_registration && (
              <p className="text-grey-600">Reg: {inv.buyer.company_registration}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Invoice date</p>
            <p className="mt-2 text-sm text-grey-700">
              {new Date(inv.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {inv.paid_at && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-grey-500">Paid on</p>
                <p className="mt-1 text-sm text-grey-700">
                  {new Date(inv.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </>
            )}
          </div>
        </section>

        <table className="mt-8 w-full border-t border-grey-100 text-sm">
          <thead>
            <tr className="border-b border-grey-100 text-left text-xs font-semibold uppercase tracking-wide text-grey-500">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="text-grey-900">
            <tr className="border-b border-grey-100">
              <td className="py-3">
                {inv.vehicle && (
                  <>
                    <p className="font-medium">
                      {inv.vehicle.year} {inv.vehicle.make} {inv.vehicle.model}
                    </p>
                    <p className="text-xs text-grey-500">
                      VIN: {inv.vehicle.vin} · {inv.vehicle.exterior_color} · {inv.vehicle.mileage_km?.toLocaleString("en-GB")} km
                    </p>
                  </>
                )}
                <p className="mt-1 text-xs text-grey-500">Winning hammer bid</p>
              </td>
              <td className="py-3 text-right tabular-nums">{formatEur(inv.amount_eur)}</td>
            </tr>
            <tr className="border-b border-grey-100">
              <td className="py-3">
                <p className="font-medium">Platform fee</p>
                <p className="text-xs text-grey-500">2.9% of hammer price</p>
              </td>
              <td className="py-3 text-right tabular-nums">{formatEur(inv.platform_fee_eur)}</td>
            </tr>
            <tr className="text-base font-bold">
              <td className="py-4">Total due</td>
              <td className="py-4 text-right tabular-nums">{formatEur(inv.total_eur)}</td>
            </tr>
          </tbody>
        </table>

        <section className="mt-8 border-t border-grey-100 pt-6 text-xs text-grey-500">
          <p>Payment terms: confirm within 36 hours of winning, then complete the wire transfer within 5 working days.</p>
          <p>Bank transfer details will be issued by our finance team.</p>
          <CustomsDisclaimer className="mt-4" />
        </section>
      </article>
    </div>
  );
}
