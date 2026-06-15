import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoicePrintTrigger } from "@/components/admin/InvoicePrintTrigger";
import { CustomsDisclaimer } from "@/components/shared/CustomsDisclaimer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEur } from "@/lib/utils";
import { verifyPaymentAction } from "./actions";

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
      payment_confirmed_at, payment_verified_at, payment_proof_urls, payment_proof_note,
      shipping_method, shipping_eur, shipping_distance_km, shipping_address, extras, extras_eur,
      shipping_line1, shipping_line2, shipping_city, shipping_postal_code, shipping_country,
      buyer:profiles!buyer_id ( id, full_name, company_name, country, email, phone, company_registration ),
      vehicle:vehicles!vehicle_id ( id, year, make, model, vin, exterior_color, mileage_km ),
      auction:auctions!auction_id ( id, end_time )
    `)
    .eq("id", id)
    .single();

  if (!invoice) notFound();
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;

  // Payment proofs live in the PRIVATE "payment-proofs" bucket — generate a
  // 7-day signed URL per file (newer entries store { path }; older/mobile
  // entries may store a plain { url }).
  const adminStorage = createAdminClient();
  const rawProofs: { path?: string; url?: string; filename?: string; uploaded_at?: string }[] =
    Array.isArray(inv.payment_proof_urls) ? inv.payment_proof_urls : [];
  const proofLinks = await Promise.all(
    rawProofs.map(async (p) => {
      let href: string | null = p.url ?? null;
      if (p.path) {
        const { data } = await adminStorage.storage
          .from("payment-proofs")
          .createSignedUrl(p.path, 60 * 60 * 24 * 7);
        href = data?.signedUrl ?? null;
      }
      return { filename: p.filename ?? "Payment proof", href, uploaded_at: p.uploaded_at };
    }),
  );

  // Structured delivery address (door-to-door) — prefer the structured columns,
  // fall back to the legacy free-text shipping_address.
  const addrLines: string[] = (() => {
    const structured = [
      inv.shipping_line1,
      inv.shipping_line2,
      [inv.shipping_postal_code, inv.shipping_city].filter(Boolean).join(" "),
      inv.shipping_country,
    ].map((s: string | null) => (s ?? "").trim()).filter(Boolean);
    if (structured.length > 0) return structured;
    return String(inv.shipping_address ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  })();
  const shippingLabel =
    inv.shipping_method === "door_to_door"
      ? `Door-to-door delivery${inv.shipping_distance_km != null ? ` (${inv.shipping_distance_km} km)` : ""}`
      : inv.shipping_method === "standard"
        ? "Standard port shipping"
        : null;
  const extrasList: { name: string; price_eur: number }[] = Array.isArray(inv.extras) ? inv.extras : [];

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10 lg:py-10 print:p-0">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-1 text-sm text-grey-500 hover:text-brand-600"
        >
          <ChevronLeft className="size-4" /> All invoices
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/api/invoice/${inv.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-grey-200 bg-white px-3 text-sm font-semibold text-grey-800 hover:bg-grey-50"
          >
            <Download className="size-4" /> Download PDF
          </a>
          <InvoicePrintTrigger />
        </div>
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
            {addrLines.length > 0 && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-grey-500">Deliver to</p>
                <p className="mt-1 text-sm leading-relaxed text-grey-700">
                  {addrLines.map((l, i) => (
                    <span key={i}>{l}{i < addrLines.length - 1 ? <br /> : null}</span>
                  ))}
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
            {shippingLabel && inv.shipping_eur != null && (
              <tr className="border-b border-grey-100">
                <td className="py-3">
                  <p className="font-medium">{shippingLabel}</p>
                  <p className="text-xs text-grey-500">Delivery</p>
                </td>
                <td className="py-3 text-right tabular-nums">{formatEur(inv.shipping_eur)}</td>
              </tr>
            )}
            {extrasList.map((e, i) => (
              <tr key={i} className="border-b border-grey-100">
                <td className="py-3">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-grey-500">Add-on service</p>
                </td>
                <td className="py-3 text-right tabular-nums">{formatEur(Number(e.price_eur) || 0)}</td>
              </tr>
            ))}
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

      {/* Payment proof + admin verification (not part of the printed invoice) */}
      <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-grey-200 bg-white p-6 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-grey-900">Payment proof</h2>
          <div className="flex items-center gap-2">
            {inv.payment_confirmed_at && (
              <Badge className="bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                Buyer confirmed {new Date(inv.payment_confirmed_at).toLocaleDateString("en-GB")}
              </Badge>
            )}
            {inv.payment_verified_at ? (
              <Badge className="bg-success-50 text-success-700 ring-1 ring-success-100">
                Verified {new Date(inv.payment_verified_at).toLocaleDateString("en-GB")}
              </Badge>
            ) : (
              <Badge className="bg-grey-100 text-grey-600 ring-1 ring-grey-200">Not verified</Badge>
            )}
          </div>
        </div>

        {proofLinks.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {proofLinks.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-grey-200 px-3 py-2">
                {p.href ? (
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-brand-700 hover:underline">
                    {p.filename}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-grey-500">{p.filename} (unavailable)</span>
                )}
                <span className="shrink-0 text-xs text-grey-500">
                  {p.uploaded_at ? new Date(p.uploaded_at).toLocaleDateString("en-GB") : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-grey-500">No payment proof submitted yet.</p>
        )}

        {inv.payment_proof_note && (
          <div className="mt-4 rounded-lg bg-grey-50 px-4 py-3 ring-1 ring-grey-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Buyer note</p>
            <p className="mt-1 text-sm text-grey-700">{inv.payment_proof_note}</p>
          </div>
        )}

        {!inv.payment_verified_at && (
          <form action={verifyPaymentAction} className="mt-5">
            <input type="hidden" name="invoiceId" value={inv.id} />
            <Button type="submit" className="h-10">Verify payment received</Button>
          </form>
        )}
      </section>
    </div>
  );
}
