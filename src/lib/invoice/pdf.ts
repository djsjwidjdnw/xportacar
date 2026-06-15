import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CUSTOMS_DISCLAIMER_TEXT } from "@/components/shared/CustomsDisclaimer";
import { pickThumbnailPhoto, thumb } from "@/lib/utils";

// `||` not `??`: NEXT_PUBLIC_SITE_URL is an empty string in prod, which would
// make the logo fetch a host-less relative URL.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://xportacar.com").replace(/\/+$/, "");

// Real receivables details (provided by the client). Both accounts are shown so
// European buyers can wire in EUR and UAE/regional buyers in AED.
const BANK = {
  beneficiary: "Global Business Consultancy L.L.C FZ",
  bank: "WIO Bank",
  bankAddress: "Etihad Airways Centre 5th Floor, Abu Dhabi, UAE",
  swift: "WIOBAEADXXX",
  ibanEur: "AE46 0860 0000 0977 0643 954",
  ibanAed: "AE94 0860 0000 0944 9287 910",
};

// Brand palette aligned to globals.css.
const BRAND = rgb(0.082, 0.439, 0.937);  // brand-600 #1570EF
const BRAND_DK = rgb(0.090, 0.361, 0.827); // brand-700 #175CD3
const RED = rgb(0.851, 0.176, 0.125);     // error-600 #D92D20
const GREY = rgb(0.4, 0.45, 0.5);          // grey-500 #667085
const DARK = rgb(0.1, 0.13, 0.16);         // grey-900 #101828
const RULE = rgb(0.918, 0.925, 0.941);     // grey-200 #EAECF0

function eur(n: number): string {
  return "EUR " + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added += 1; }
  return d;
}
function wrap(s: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
// Strip non-WinAnsi chars Helvetica can't render (ü -> u etc.).
const ascii = (s: string) => String(s ?? "").replace(/ü/g, "u").replace(/Ü/g, "U").replace(/[^\x20-\x7E]/g, "");

async function fetchImage(pdf: PDFDocument, url: string, ms = 4000): Promise<PDFImage | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    // Detect PNG (89 50 4E 47) vs JPEG (FF D8).
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isPng ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
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
}

/**
 * Render the invoice PDF for `invoiceId` and return its bytes + filename.
 * Used by BOTH the /api/invoice/[id]/pdf route and the invoice email attachment.
 * Uses the RLS-scoped server client, so it only renders an invoice the caller
 * (the signed-in buyer or staff) is allowed to read. Returns null if not found.
 */
export async function renderInvoicePdf(
  invoiceId: string,
  overrides: InvoicePdfOverrides = {},
): Promise<{ buffer: Buffer; filename: string } | null> {
  const supabase = overrides.useAdminClient ? createAdminClient() : await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, amount_eur, platform_fee_eur, total_eur, status, created_at, payment_confirmed_at,
      shipping_method, shipping_eur, shipping_distance_km, shipping_address, extras, extras_eur,
      buyer:profiles!buyer_id ( full_name, company_name, country, email, phone, company_registration ),
      vehicle:vehicles!vehicle_id ( year, make, model, trim, vin, exterior_color, mileage_km, vehicle_photos ( url, sort_order, caption, category ) )
    `)
    .eq("id", invoiceId)
    .single();
  if (!invoice) return null;
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;

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

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const W = 595.28;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 50;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = DARK) =>
    page.drawText(ascii(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = DARK) =>
    page.drawText(ascii(s), { x: xRight - f.widthOfTextAtSize(ascii(s), size), y: yy, size, font: f, color });

  // Header band with the logo image (falls back to a wordmark if the fetch fails).
  page.drawRectangle({ x: 0, y: 802, width: W, height: 40, color: BRAND });
  const logo = await fetchImage(pdf, `${SITE_URL}/logos/xportacar-logo.jpg`);
  if (logo) {
    const h = 22, w = h * (logo.width / logo.height);
    page.drawImage(logo, { x: M, y: 811, width: w, height: h });
  } else {
    text("XPORTACAR", M, 815, 18, bold, rgb(1, 1, 1));
  }
  right("INVOICE", W - M, 813, 18, bold, rgb(1, 1, 1));

  let y = 782;
  // Company (left) + meta (right)
  text("XportACar", M, y, 12, bold, BRAND); y -= 13;
  text("operated by Global Business Consultancy L.L.C-FZ", M, y, 9, font, GREY); y -= 11;
  text("Dubai, United Arab Emirates", M, y, 9, font, GREY); y -= 11;
  text("contact@xportacar.com", M, y, 9, font, GREY);

  right(number, W - M, 782, 11, bold, DARK);
  right(`Date: ${fmtDate(created)}`, W - M, 768, 9, font, GREY);
  right(`Status: ${String(inv.status).toUpperCase()}`, W - M, 756, 9, font, GREY);
  right(`Payment due: ${fmtDate(payDeadline)}`, W - M, 744, 9, font, GREY);

  y = 730;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: RULE });
  y -= 20;

  // Vehicle hero photo (left) + details (right of photo)
  const v = inv.vehicle;
  const heroUrl = v?.vehicle_photos ? pickThumbnailPhoto(v.vehicle_photos)?.url : null;
  const hero = heroUrl ? await fetchImage(pdf, thumb(heroUrl, 600)) : null;
  const photoTop = y;
  let detailX = M;
  if (hero) {
    const pw = 170, ph = Math.min(120, pw * (hero.height / hero.width));
    page.drawRectangle({ x: M, y: photoTop - ph, width: pw, height: ph, borderColor: RULE, borderWidth: 1 });
    page.drawImage(hero, { x: M, y: photoTop - ph, width: pw, height: ph });
    detailX = M + pw + 16;
  }
  let dy = photoTop - 4;
  text("VEHICLE", detailX, dy, 8, bold, GREY); dy -= 15;
  if (v) {
    text(`${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`, detailX, dy, 12, bold); dy -= 14;
    text(`VIN: ${v.vin ?? "—"}`, detailX, dy, 9, font, GREY); dy -= 12;
    text(`${v.exterior_color ?? ""}${v.mileage_km != null ? ` · ${Number(v.mileage_km).toLocaleString("en-GB")} km` : ""}`, detailX, dy, 9, font, GREY); dy -= 12;
  }
  y = Math.min(hero ? photoTop - (Math.min(120, 170 * (hero.height / hero.width))) : dy, dy) - 16;

  // Bill To (left) + Deliver To (right)
  const colR = M + (W - 2 * M) / 2 + 10;
  let ly = y, ry = y;
  text("BILL TO", M, ly, 8, bold, GREY); ly -= 14;
  text(inv.buyer?.company_name ?? inv.buyer?.full_name ?? "—", M, ly, 11, bold); ly -= 13;
  if (inv.buyer?.full_name && inv.buyer?.company_name) { text(inv.buyer.full_name, M, ly, 9, font, GREY); ly -= 11; }
  if (inv.buyer?.email) { text(inv.buyer.email, M, ly, 9, font, GREY); ly -= 11; }
  if (inv.buyer?.phone) { text(inv.buyer.phone, M, ly, 9, font, GREY); ly -= 11; }
  if (inv.buyer?.country) { text(inv.buyer.country, M, ly, 9, font, GREY); ly -= 11; }

  if (inv.shipping_address) {
    text("DELIVER TO", colR, ry, 8, bold, GREY); ry -= 14;
    for (const ln of String(inv.shipping_address).split(/\r?\n/).slice(0, 6)) {
      if (!ln.trim()) continue;
      for (const wl of wrap(ln, font, 9, W - M - colR)) { text(wl, colR, ry, 9, font, GREY); ry -= 11; }
    }
  }
  y = Math.min(ly, ry) - 14;

  // Line items
  page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 20, color: rgb(0.969, 0.976, 0.988) });
  text("DESCRIPTION", M + 8, y + 2, 8, bold, GREY);
  right("AMOUNT", W - M - 8, y + 2, 8, bold, GREY);
  y -= 22;
  const line = (label: string, amount: number) => {
    text(label, M + 8, y, 10);
    right(eur(amount), W - M - 8, y, 10);
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: RULE });
    y -= 12;
  };
  line("Winning hammer bid", hammer);
  line("Platform fee (2.9%)", fee);
  line(shippingLabel, shippingEur);
  for (const e of extrasList) line(e.name || "Extra", Number(e.price_eur) || 0);

  y -= 4;
  text("TOTAL DUE", M + 8, y, 12, bold);
  right(eur(total), W - M - 8, y, 14, bold, BRAND);
  y -= 26;

  // Customs disclaimer
  const discLines = wrap(CUSTOMS_DISCLAIMER_TEXT, bold, 9, W - 2 * M - 16);
  const boxH = discLines.length * 12 + 12;
  page.drawRectangle({ x: M, y: y - boxH + 6, width: W - 2 * M, height: boxH, color: rgb(0.996, 0.949, 0.949), borderColor: RED, borderWidth: 1 });
  let cy = y - 6;
  for (const ln of discLines) { text(ln, M + 8, cy, 9, bold, RED); cy -= 12; }
  y = y - boxH - 6;

  // Payment instructions + BOTH bank accounts
  y -= 10;
  text("PAYMENT INFORMATION", M, y, 8, bold, BRAND_DK); y -= 14;
  text(`Confirm payment within 36 hours of winning — by ${fmtDate(confirmDeadline)}.`, M, y, 9, font, DARK); y -= 11;
  text(`Complete the wire transfer within 5 working days of confirming — by ${fmtDate(payDeadline)}.`, M, y, 9, font, DARK); y -= 16;
  const LBL = M, VAL = M + 78;
  const bankRow = (label: string, value: string) => { text(label, LBL, y, 9, bold, GREY); text(value, VAL, y, 9, font, DARK); y -= 12; };
  bankRow("Beneficiary:", BANK.beneficiary);
  bankRow("Bank:", `${BANK.bank}, ${BANK.bankAddress}`);
  bankRow("BIC/SWIFT:", BANK.swift);
  bankRow("EUR IBAN:", BANK.ibanEur);
  bankRow("AED IBAN:", BANK.ibanAed);
  bankRow("Reference:", number);

  text("Thank you for your business — XportACar · contact@xportacar.com", M, 40, 8, font, GREY);

  const bytes = await pdf.save();
  return { buffer: Buffer.from(bytes), filename: `${number}.pdf` };
}
