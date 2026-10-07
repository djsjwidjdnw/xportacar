import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { sendInvoiceEmail } from "@/lib/email";
import { renderInvoicePdf } from "@/lib/invoice/pdf";
import { signedInvoicePdfUrl } from "@/lib/invoice/signedUrl";
import { serverShippingEur, serverPriceExtras } from "@/lib/distance";

// Single source of truth for finalizing a buyer's shipping + extras selection on
// an invoice and sending the invoice email. Called by BOTH the web server action
// (finalizeInvoiceShippingAction) and the mobile endpoint
// (POST /api/invoice/[id]/finalize) so the email fires no matter the platform.
//
// `db` is an RLS-scoped client authenticated AS THE BUYER (cookie session on web,
// bearer token on mobile). Buyers cannot UPDATE invoices (migration 032): the
// write goes through the SECURITY DEFINER RPC finalize_my_invoice(), which only
// touches the caller's own PENDING invoice and prices everything in the database
// (total = hammer + 2.9% fee + shipping + extras). Only the buyer's choices are
// sent — never an amount — and the email uses the amounts the database stored.
// Email is best-effort.

// What finalize_my_invoice() stored (numeric columns arrive as JSON numbers).
interface FinalizedInvoice {
  invoice_number: string | null;
  shipping_method: "standard" | "door_to_door";
  shipping_eur: number;
  shipping_distance_km: number | null;
  shipping_address: string | null;
  extras: { name: string; price_eur: number }[];
  extras_eur: number;
  amount_eur: number;
  platform_fee_eur: number;
  total_eur: number;
}

const RPC_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Sign in to confirm your order.",
  INVOICE_NOT_FOUND: "Invoice not found.",
  INVOICE_NOT_PENDING: "This invoice can no longer be changed.",
};

const finiteOrNull = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

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
  db: SupabaseClient,
  input: FinalizeInvoiceInput,
): Promise<{ ok: boolean; error?: string; totalEur?: number; pdfUrl?: string }> {
  const { data: inv } = await db
    .from("invoices")
    .select(
      "id, invoice_number, vehicle:vehicles!vehicle_id(year, make, model, trim), buyer:profiles!buyer_id(email, language)",
    )
    .eq("id", input.invoiceId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const i = inv as any;
  if (!i) return { ok: false, error: "Invoice not found." };

  // SECURITY: never send a euro amount. input.shippingEur / input.distanceKm /
  // extras[].price_eur are dropped here; the RPC re-prices shipping and extras
  // itself, so a buyer cannot deflate total_eur (which flows to Stripe).
  const { data: stored, error } = await db.rpc("finalize_my_invoice", {
    p_invoice_id: input.invoiceId,
    p_shipping_method: input.shippingMethod,
    p_line1: input.shippingLine1?.trim() || null,
    p_line2: input.shippingLine2?.trim() || null,
    p_city: input.shippingCity?.trim() || null,
    p_postal_code: input.shippingPostalCode?.trim() || null,
    p_country: input.shippingCountry?.trim()?.toUpperCase() || null,
    p_latitude: finiteOrNull(input.shippingLatitude),
    p_longitude: finiteOrNull(input.shippingLongitude),
    p_extras: (Array.isArray(input.extras) ? input.extras : []).map((e) => ({ name: String(e?.name ?? "") })),
  });
  if (error) return { ok: false, error: RPC_ERRORS[error.message] ?? error.message };
  const f = stored as FinalizedInvoice;
  const shippingEur = Number(f.shipping_eur);
  const shippingDistanceKm = f.shipping_distance_km;
  const formattedAddress = f.shipping_address;
  const extras = Array.isArray(f.extras) ? f.extras : [];
  const hammer = Number(f.amount_eur) || 0;
  const feeEur = Number(f.platform_fee_eur);
  const totalEur = Number(f.total_eur);

  // The database prices the order; these TS helpers price what the buyer was
  // shown. They are ports of each other — log loudly if they ever drift apart.
  const shown = serverShippingEur(input.shippingMethod, {
    lat: input.shippingLatitude, lon: input.shippingLongitude, country: input.shippingCountry, city: input.shippingCity,
  });
  const shownExtras = serverPriceExtras(input.extras).reduce((s, e) => s + e.price_eur, 0);
  if (shown.eur !== shippingEur || shownExtras !== Number(f.extras_eur)) {
    console.warn(
      `[finalize] invoice ${input.invoiceId}: DB priced shipping ${shippingEur} + extras ${f.extras_eur}, ` +
        `TS helpers say ${shown.eur} + ${shownExtras} — keep distance.ts and migration 032 in sync`,
    );
  }

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
      f.shipping_method === "door_to_door"
        ? shippingDistanceKm
          ? `Door-to-door delivery (${shippingDistanceKm} km)`
          : "Door-to-door delivery"
        : "Standard port shipping";
    if (!buyer?.email) {
      console.warn(`[invoice email] invoice ${num}: no buyer email on file — NOT sent`);
    } else {
      let attachments: { filename: string; content: Buffer }[] | undefined;
      try {
        const pdf = await renderInvoicePdf(input.invoiceId, { client: db });
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
