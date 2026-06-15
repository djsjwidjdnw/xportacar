import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendInvoiceEmail } from "@/lib/email";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { signedInvoicePdfUrl } from "@/lib/invoice/signedUrl";
import { serverShippingEur, serverPriceExtras } from "@/lib/distance";

// Single source of truth for finalizing a buyer's shipping + extras selection on
// an invoice and sending the invoice email. Called by BOTH the web server action
// (finalizeInvoiceShippingAction) and the mobile endpoint
// (POST /api/invoice/[id]/finalize) so the email fires no matter the platform.
//
// The caller MUST authorize ownership of the invoice first. This persists with
// the service-role client and recomputes total = hammer + 2.9% fee + shipping +
// extras. The email (PDF attachment + signed login-free link) is best-effort.

const PLATFORM_FEE_PCT = 0.029;

export interface FinalizeInvoiceInput {
  invoiceId: string;
  shippingMethod: "standard" | "door_to_door";
  shippingEur: number;
  distanceKm?: number | null;
  shippingLine1?: string | null;
  shippingLine2?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null; // ISO 3166-1 alpha-2
  shippingLatitude?: number | null;
  shippingLongitude?: number | null;
  extras?: { name: string; price_eur: number }[];
}

export async function finalizeInvoiceAndEmail(
  input: FinalizeInvoiceInput,
): Promise<{ ok: boolean; error?: string; totalEur?: number; pdfUrl?: string }> {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invoices")
    .select(
      "id, amount_eur, invoice_number, vehicle:vehicles!vehicle_id(year, make, model, trim), buyer:profiles!buyer_id(email, language)",
    )
    .eq("id", input.invoiceId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const i = inv as any;
  if (!i) return { ok: false, error: "Invoice not found." };

  // SECURITY: never trust client-supplied euro amounts. Recompute shipping from
  // the method + (geocoded coords or country/city), and re-price extras against
  // the server catalog. input.shippingEur / input.distanceKm / extras[].price_eur
  // are ignored — a buyer cannot deflate total_eur (which flows to Stripe).
  const { eur: shippingEur, distanceKm: shippingDistanceKm } = serverShippingEur(
    input.shippingMethod,
    { lat: input.shippingLatitude, lon: input.shippingLongitude, country: input.shippingCountry, city: input.shippingCity },
  );
  const extras = serverPriceExtras(input.extras);
  const extrasEur = extras.reduce((s, e) => s + e.price_eur, 0);
  const hammer = Number(i.amount_eur) || 0;
  const feeEur = Math.round(hammer * PLATFORM_FEE_PCT * 100) / 100;
  const totalEur = Math.round((hammer + feeEur + shippingEur + extrasEur) * 100) / 100;

  const structuredLines = [
    input.shippingLine1?.trim(),
    input.shippingLine2?.trim(),
    [input.shippingPostalCode?.trim(), input.shippingCity?.trim()].filter(Boolean).join(" "),
    input.shippingCountry?.trim()?.toUpperCase(),
  ].filter((l): l is string => !!l && l.length > 0);
  const formattedAddress = structuredLines.length > 0 ? structuredLines.join("\n") : null;

  const { error } = await admin
    .from("invoices")
    .update({
      shipping_method: input.shippingMethod,
      shipping_eur: shippingEur,
      shipping_distance_km: shippingDistanceKm,
      shipping_address: formattedAddress,
      shipping_line1: input.shippingLine1?.trim() || null,
      shipping_line2: input.shippingLine2?.trim() || null,
      shipping_city: input.shippingCity?.trim() || null,
      shipping_postal_code: input.shippingPostalCode?.trim() || null,
      shipping_country: input.shippingCountry?.trim()?.toUpperCase() || null,
      shipping_latitude: input.shippingLatitude ?? null,
      shipping_longitude: input.shippingLongitude ?? null,
      extras,
      extras_eur: extrasEur,
      total_eur: totalEur,
    })
    .eq("id", input.invoiceId);
  if (error) return { ok: false, error: error.message };

  const pdfUrl = signedInvoicePdfUrl(input.invoiceId);

  // Send the invoice email — PDF attachment + signed (login-free) link.
  // Best-effort: never block the order on email. Verbose logs so the next test
  // is diagnosable in Vercel logs.
  try {
    const veh = Array.isArray(i.vehicle) ? i.vehicle[0] : i.vehicle;
    const buyer = Array.isArray(i.buyer) ? i.buyer[0] : i.buyer;
    const num = i.invoice_number ?? input.invoiceId.slice(0, 8);
    const vehicleTitle = veh
      ? `${veh.year} ${veh.make} ${veh.model}${veh.trim ? ` ${veh.trim}` : ""}`
      : "Vehicle";
    const shippingLabel =
      input.shippingMethod === "door_to_door"
        ? shippingDistanceKm
          ? `Door-to-door delivery (${shippingDistanceKm} km)`
          : "Door-to-door delivery"
        : "Standard port shipping";
    if (!buyer?.email) {
      console.warn(`[invoice email] invoice ${num}: no buyer email on file — NOT sent`);
    } else {
      let attachments: { filename: string; content: Buffer }[] | undefined;
      try {
        const pdf = await renderInvoicePdf(input.invoiceId, { useAdminClient: true });
        if (pdf) attachments = [{ filename: `invoice-${num}.pdf`, content: pdf.buffer }];
        else console.warn(`[invoice email] invoice ${num}: renderInvoicePdf returned null`);
      } catch (e) {
        console.error(`[invoice email] invoice ${num}: PDF render failed:`, (e as Error)?.message);
      }
      console.info(`[invoice email] invoice ${num} → sending to ${buyer.email} (attachment: ${attachments ? "yes" : "no"})`);
      await sendInvoiceEmail({
        to: buyer.email,
        invoiceNumber: num,
        invoiceId: input.invoiceId,
        vehicleTitle,
        hammerEur: hammer,
        feeEur,
        shippingEur,
        shippingLabel,
        shippingAddress: formattedAddress,
        pdfUrl,
        extras: extras.map((e) => ({ name: e.name, priceEur: Number(e.price_eur) || 0 })),
        totalEur,
        locale: buyer.language,
        attachments,
      });
      console.info(`[invoice email] invoice ${num} → sent to ${buyer.email}`);
    }
  } catch (e) {
    console.error("[invoice email] send failed:", (e as Error)?.message);
  }

  return { ok: true, totalEur, pdfUrl };
}
