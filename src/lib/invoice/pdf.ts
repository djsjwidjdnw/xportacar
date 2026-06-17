import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMS_DISCLAIMER_TEXT } from "@/components/shared/CustomsDisclaimer";
import { pickThumbnailPhoto, thumb } from "@/lib/utils";
import { buildInvoicePdfBytes, type InvoiceLineItem, type InvoicePdfData } from "@/lib/invoice/pdfLayout";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added += 1; }
  return d;
}

// Fetch a remote image (the dynamic vehicle hero) and return raw bytes + a PNG/JPEG
// flag. The branded letterhead logo is embedded from a base64 constant in pdfLayout,
// so the only network call here is the per-invoice hero photo (best-effort).
async function fetchImageBytes(url: string, ms = 4000): Promise<{ bytes: Uint8Array; isPng: boolean } | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, isPng: bytes[0] === 0x89 && bytes[1] === 0x50 };
  } catch {
    return null;
  }
}

export interface InvoicePdfOverrides {
  shippingLabel?: string;
  shippingEur?: number;
  tuvEur?: number;
  /** Use the service-role client (bypasses RLS). Only set this once the caller
   *  has independently authorized access to THIS invoice — e.g. a valid signed
   *  token, or an already-verified invoice owner. */
  useAdminClient?: boolean;
  /** Render with a caller-supplied client (e.g. a bearer/cookie RLS-scoped
   *  client). Preferred over useAdminClient for user-authenticated requests. */
  client?: SupabaseClient;
}

/**
 * Render the branded invoice PDF for `invoiceId` and return its bytes + filename.
 * Used by BOTH the /api/invoice/[id]/pdf route and the invoice email attachment.
 * Uses the RLS-scoped server client, so it only renders an invoice the caller
 * (the signed-in buyer or staff) is allowed to read. Returns null if not found.
 *
 * The visual layout (XPortAcar letterhead) lives in the pure, testable
 * `buildInvoicePdfBytes` (pdfLayout.ts); this function only resolves the invoice
 * row + server-authoritative pricing and fetches the hero photo.
 */
export async function renderInvoicePdf(
  invoiceId: string,
  overrides: InvoicePdfOverrides = {},
): Promise<{ buffer: Buffer; filename: string } | null> {
  const supabase = overrides.client ?? (overrides.useAdminClient ? createAdminClient() : await createClient());
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, amount_eur, platform_fee_eur, total_eur, status, created_at, payment_confirmed_at,
      shipping_method, shipping_eur, shipping_distance_km, shipping_address, extras, extras_eur,
      buyer:profiles!buyer_id ( full_name, company_name, country, email, phone, company_registration ),
      vehicle:vehicles!vehicle_id ( year, make, model, trim, vin, exterior_color, mileage_km, vehicle_photos ( url, sort_order, caption, category ) )
    `)
    .eq("id", invoiceId)
    .single();
  if (!invoice) {
    console.warn(`[invoice pdf] invoice ${invoiceId} not readable (admin=${!!overrides.useAdminClient}, scoped=${!!overrides.client}): ${invErr?.message ?? "no row"}`);
    return null;
  }
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;

  // ─── Pricing resolution (display) — mirrors the server-authoritative finalize ───
  const persistedShipping = inv.shipping_eur != null ? Number(inv.shipping_eur) : null;
  const persistedExtras: { name: string; price_eur: number }[] = Array.isArray(inv.extras) ? inv.extras : [];
  const shippingEur = persistedShipping ?? (Number(overrides.shippingEur ?? 0) || 0);
  const shippingLabel = inv.shipping_method === "door_to_door"
    ? `Door-to-Door Delivery${inv.shipping_distance_km != null ? ` (${inv.shipping_distance_km} km)` : ""}`
    : inv.shipping_method === "standard"
      ? "Standard Port Shipping"
      : (overrides.shippingLabel ?? "Shipping");
  const extrasList = persistedExtras.length > 0
    ? persistedExtras
    : (Number(overrides.tuvEur ?? 0) > 0 ? [{ name: "German Registration (TUV)", price_eur: Number(overrides.tuvEur) }] : []);
  const extrasEur = extrasList.reduce((s, e) => s + (Number(e.price_eur) || 0), 0);

  const hammer = Number(inv.amount_eur) || 0;
  const fee = Number(inv.platform_fee_eur) || Math.round(hammer * 0.029 * 100) / 100;
  const total = inv.total_eur != null && persistedShipping != null
    ? Number(inv.total_eur)
    : hammer + fee + shippingEur + extrasEur;

  const created = inv.created_at ? new Date(inv.created_at) : new Date();
  const confirmDeadline = new Date(created.getTime() + 36 * 3600_000);
  const payDeadline = addWorkingDays(inv.payment_confirmed_at ? new Date(inv.payment_confirmed_at) : created, 5);
  const number = inv.invoice_number ?? inv.id.slice(0, 8);

  // ─── Vehicle hero (the only per-invoice network fetch) ───
  const v = inv.vehicle;
  const heroUrl = v?.vehicle_photos ? pickThumbnailPhoto(v.vehicle_photos)?.url : null;
  const hero = heroUrl ? await fetchImageBytes(thumb(heroUrl, 600)) : null;

  // ─── Buyer block ───
  const buyerName = inv.buyer?.company_name ?? inv.buyer?.full_name ?? "—";
  const buyerSubName = inv.buyer?.full_name && inv.buyer?.company_name ? inv.buyer.full_name : null;
  const vehicleMeta = v
    ? `${v.exterior_color ?? ""}${v.mileage_km != null ? `${v.exterior_color ? " · " : ""}${Number(v.mileage_km).toLocaleString("en-GB")} km` : ""}`.trim() || null
    : null;
  const shippingAddressLines = inv.shipping_address
    ? String(inv.shipping_address).split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const lineItems: InvoiceLineItem[] = [
    { label: "Winning hammer bid", amount: hammer },
    { label: "Platform fee (2.9%)", amount: fee },
    { label: shippingLabel, amount: shippingEur },
    ...extrasList.map((e) => ({ label: e.name || "Extra", amount: Number(e.price_eur) || 0 })),
  ];

  const data: InvoicePdfData = {
    number,
    statusLabel: String(inv.status ?? "pending").toUpperCase(),
    isPaid: String(inv.status ?? "").toLowerCase() === "paid",
    dateStr: fmtDate(created),
    payDueStr: fmtDate(payDeadline),
    confirmByStr: fmtDate(confirmDeadline),
    payByStr: fmtDate(payDeadline),
    buyerName,
    buyerSubName,
    buyerEmail: inv.buyer?.email ?? null,
    buyerPhone: inv.buyer?.phone ?? null,
    buyerCountry: inv.buyer?.country ?? null,
    vehicleTitle: v ? `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}` : null,
    vehicleVin: v?.vin ?? null,
    vehicleMeta,
    shippingAddressLines,
    hero,
    lineItems,
    totalEur: total,
    disclaimer: CUSTOMS_DISCLAIMER_TEXT,
  };

  const bytes = await buildInvoicePdfBytes(data);
  return { buffer: Buffer.from(bytes), filename: `${number}.pdf` };
}
