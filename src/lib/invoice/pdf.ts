import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMS_DISCLAIMER_TEXT } from "@/components/shared/CustomsDisclaimer";
import { buildInvoicePdfBytes, type InvoiceLineItem, type InvoicePdfData } from "@/lib/invoice/pdfLayout";

// `||` not `??`: NEXT_PUBLIC_SITE_URL is an empty string in prod, which would make
// the letterhead fetch a host-less relative URL.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://xportacar.com").replace(/\/+$/, "");

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added += 1; }
  return d;
}

// The XPortAcar letterhead (public/invoice-letterhead.pdf) is the locked brand
// template — we overlay the invoice text onto its blank middle. Load it once per
// warm lambda: from disk when available (dev / self-hosted), else over HTTP (on
// Vercel `public/` is served at the site root — the same proven path the old logo
// used). Only successful loads are cached, so a transient failure retries.
let letterheadCache: Uint8Array | undefined;
async function getLetterheadBytes(): Promise<Uint8Array | null> {
  if (letterheadCache) return letterheadCache;
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "public", "invoice-letterhead.pdf"));
    letterheadCache = new Uint8Array(buf);
    return letterheadCache;
  } catch { /* fall through to HTTP */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${SITE_URL}/invoice-letterhead.pdf`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) { letterheadCache = new Uint8Array(await res.arrayBuffer()); return letterheadCache; }
  } catch { /* ignore */ }
  return null;
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
 * Render the invoice PDF for `invoiceId` and return its bytes + filename.
 * Used by BOTH the /api/invoice/[id]/pdf route and the invoice email attachment.
 * Uses the RLS-scoped server client, so it only renders an invoice the caller
 * (the signed-in buyer or staff) is allowed to read. Returns null if not found.
 *
 * Visual output = the XPortAcar letterhead with the invoice content overlaid in
 * its blank middle (see pdfLayout.ts). This function only resolves the invoice row
 * + server-authoritative pricing and loads the letterhead template.
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
      shipping_method, shipping_eur, shipping_distance_km, extras, extras_eur,
      buyer:profiles!buyer_id ( full_name, company_name, country, email, phone, company_registration ),
      vehicle:vehicles!vehicle_id ( year, make, model, trim, vin, exterior_color, mileage_km )
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

  const v = inv.vehicle;
  const buyerName = inv.buyer?.company_name ?? inv.buyer?.full_name ?? "—";
  const buyerSubName = inv.buyer?.full_name && inv.buyer?.company_name ? inv.buyer.full_name : null;

  const lineItems: InvoiceLineItem[] = [
    { label: "Winning hammer bid", amount: hammer },
    { label: "Platform fee (2.9%)", amount: fee },
    { label: shippingLabel, amount: shippingEur },
    ...extrasList.map((e) => ({ label: e.name || "Extra", amount: Number(e.price_eur) || 0 })),
  ];

  const data: InvoicePdfData = {
    number,
    statusLabel: String(inv.status ?? "pending").toUpperCase(),
    dateStr: fmtDate(created),
    payDueStr: fmtDate(payDeadline),
    confirmByStr: fmtDate(confirmDeadline),
    payByStr: fmtDate(payDeadline),
    buyerName,
    buyerSubName,
    buyerEmail: inv.buyer?.email ?? null,
    vehicleTitle: v ? `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}` : null,
    vehicleVin: v?.vin ?? null,
    vehicleMileage: v?.mileage_km != null ? `${Number(v.mileage_km).toLocaleString("en-GB")} km` : null,
    lineItems,
    totalEur: total,
    disclaimer: CUSTOMS_DISCLAIMER_TEXT,
  };

  const letterhead = await getLetterheadBytes();
  const bytes = await buildInvoicePdfBytes(data, letterhead);
  return { buffer: Buffer.from(bytes), filename: `${number}.pdf` };
}
