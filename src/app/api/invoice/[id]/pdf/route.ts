// Real downloadable PDF invoice (pdf-lib, pure-JS — works in the serverless
// runtime, no DOM). GET /api/invoice/:id/pdf?shipping=&shippingEur=&tuvEur=
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { CUSTOMS_DISCLAIMER_TEXT } from "@/components/shared/CustomsDisclaimer";

const BRAND = rgb(0.082, 0.439, 0.937);
const RED = rgb(0.851, 0.176, 0.125);
const GREY = rgb(0.4, 0.45, 0.5);
const DARK = rgb(0.1, 0.13, 0.16);

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, amount_eur, platform_fee_eur, total_eur, status, created_at, payment_confirmed_at,
      shipping_method, shipping_eur, shipping_distance_km, shipping_address, extras, extras_eur,
      buyer:profiles!buyer_id ( full_name, company_name, country, email, phone, company_registration ),
      vehicle:vehicles!vehicle_id ( year, make, model, trim, vin, exterior_color, mileage_km )
    `)
    .eq("id", id)
    .single();

  if (!invoice) return new Response("Not found", { status: 404 });
  // deno-lint-ignore no-explicit-any
  const inv = invoice as any;

  // Prefer the PERSISTED breakdown (finalizeInvoiceShippingAction) when present;
  // otherwise fall back to the query-param preview the won page passes.
  const sp = req.nextUrl.searchParams;
  const persistedShipping = inv.shipping_eur != null ? Number(inv.shipping_eur) : null;
  const persistedExtras: { name: string; price_eur: number }[] = Array.isArray(inv.extras) ? inv.extras : [];

  const shippingEur = persistedShipping ?? (Number(sp.get("shippingEur") ?? 0) || 0);
  const shippingLabel = inv.shipping_method === "door_to_door"
    ? `Door-to-Door Delivery${inv.shipping_distance_km != null ? ` (${inv.shipping_distance_km} km)` : ""}`
    : inv.shipping_method === "standard"
      ? "Standard Port Shipping"
      : (sp.get("shipping") ?? "Shipping");
  // Extras: persisted list, else the legacy single TÜV query param.
  const extrasList = persistedExtras.length > 0
    ? persistedExtras
    : (Number(sp.get("tuvEur") ?? 0) > 0 ? [{ name: "German Registration (TUV)", price_eur: Number(sp.get("tuvEur")) }] : []);
  const extrasEur = extrasList.reduce((s, e) => s + (Number(e.price_eur) || 0), 0);

  const hammer = Number(inv.amount_eur) || 0;
  const fee = Number(inv.platform_fee_eur) || Math.round(hammer * 0.029 * 100) / 100;
  const total = inv.total_eur != null && persistedShipping != null
    ? Number(inv.total_eur)
    : hammer + fee + shippingEur + extrasEur;

  const created = inv.created_at ? new Date(inv.created_at) : new Date();
  const confirmDeadline = new Date(created.getTime() + 36 * 3600_000);
  const payDeadline = addWorkingDays(inv.payment_confirmed_at ? new Date(inv.payment_confirmed_at) : created, 5);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const W = 595.28;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 50;
  let y = 800;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = DARK) =>
    page.drawText(s ?? "", { x, y: yy, size, font: f, color });
  const right = (s: string, xRight: number, yy: number, size = 10, f = font, color = DARK) =>
    page.drawText(s ?? "", { x: xRight - f.widthOfTextAtSize(s ?? "", size), y: yy, size, font: f, color });

  // Header band
  page.drawRectangle({ x: 0, y: 812, width: W, height: 30, color: BRAND });
  text("XPORTACAR", M, 820, 16, bold, rgb(1, 1, 1));

  text("XportACar", M, y, 13, bold, BRAND);
  y -= 14;
  text("operated by Global Business Consultancy L.L.C-FZ", M, y, 9, font, GREY); y -= 12;
  text("Dubai, United Arab Emirates", M, y, 9, font, GREY); y -= 12;
  text("info@xportacar.com", M, y, 9, font, GREY);

  // Invoice meta (right)
  right("INVOICE", W - M, 786, 20, bold, DARK);
  right(inv.invoice_number ?? inv.id.slice(0, 8), W - M, 768, 10, bold, GREY);
  right(`Date: ${fmtDate(created)}`, W - M, 754, 9, font, GREY);
  right(`Status: ${String(inv.status).toUpperCase()}`, W - M, 742, 9, font, GREY);

  y = 720;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: rgb(0.9, 0.92, 0.94) });
  y -= 22;

  // Bill to
  text("BILL TO", M, y, 8, bold, GREY); y -= 14;
  text(inv.buyer?.company_name ?? inv.buyer?.full_name ?? "—", M, y, 11, bold); y -= 13;
  if (inv.buyer?.full_name && inv.buyer?.company_name) { text(inv.buyer.full_name, M, y, 9, font, GREY); y -= 12; }
  if (inv.buyer?.email) { text(inv.buyer.email, M, y, 9, font, GREY); y -= 12; }
  if (inv.buyer?.phone) { text(inv.buyer.phone, M, y, 9, font, GREY); y -= 12; }
  if (inv.buyer?.country) { text(inv.buyer.country, M, y, 9, font, GREY); y -= 12; }
  if (inv.buyer?.company_registration) { text(`Reg: ${inv.buyer.company_registration}`, M, y, 9, font, GREY); y -= 12; }

  // Vehicle
  y -= 12;
  text("VEHICLE", M, y, 8, bold, GREY); y -= 14;
  const v = inv.vehicle;
  if (v) {
    text(`${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`, M, y, 11, bold); y -= 13;
    text(`VIN: ${v.vin ?? "—"}`, M, y, 9, font, GREY); y -= 12;
    text(`${v.exterior_color ?? ""}${v.mileage_km != null ? ` · ${Number(v.mileage_km).toLocaleString("en-GB")} km` : ""}`, M, y, 9, font, GREY); y -= 12;
  }

  // Line items table
  y -= 16;
  page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 20, color: rgb(0.96, 0.97, 0.98) });
  text("DESCRIPTION", M + 8, y + 2, 8, bold, GREY);
  right("AMOUNT", W - M - 8, y + 2, 8, bold, GREY);
  y -= 22;

  const line = (label: string, amount: number) => {
    text(label, M + 8, y, 10);
    right(eur(amount), W - M - 8, y, 10);
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.92, 0.94, 0.96) });
    y -= 12;
  };
  line("Winning hammer bid", hammer);
  line("Platform fee (2.9%)", fee);
  line(shippingLabel, shippingEur);
  // ü → u so pdf-lib's Helvetica can render the extra labels.
  for (const e of extrasList) line((e.name || "Extra").replace(/ü/g, "u").replace(/Ü/g, "U"), Number(e.price_eur) || 0);

  // Total
  y -= 4;
  text("TOTAL DUE", M + 8, y, 12, bold);
  right(eur(total), W - M - 8, y, 14, bold, BRAND);
  y -= 26;

  // Customs disclaimer (red box) — wrap with the SAME bold font used to draw,
  // otherwise lines measured in regular Helvetica render wider in bold and spill
  // past the box's right border.
  const discLines = wrap(CUSTOMS_DISCLAIMER_TEXT, bold, 9, W - 2 * M - 16);
  const boxH = discLines.length * 12 + 12;
  page.drawRectangle({ x: M, y: y - boxH + 6, width: W - 2 * M, height: boxH, color: rgb(0.996, 0.949, 0.949), borderColor: RED, borderWidth: 1 });
  let dy = y - 6;
  for (const ln of discLines) { text(ln, M + 8, dy, 9, bold, RED); dy -= 12; }
  y = y - boxH - 6;

  // Payment instructions + deadlines
  y -= 10;
  text("PAYMENT INSTRUCTIONS", M, y, 8, bold, GREY); y -= 14;
  text(`Confirm payment within 36 hours of winning — by ${fmtDate(confirmDeadline)}.`, M, y, 9, font, DARK); y -= 12;
  text(`Complete the wire transfer within 5 working days of confirming — by ${fmtDate(payDeadline)}.`, M, y, 9, font, DARK); y -= 12;
  text("Pay by wire transfer to XportACar (Global Business Consultancy L.L.C-FZ).", M, y, 9, font, DARK); y -= 12;
  text("Bank account details will be sent to your registered email.", M, y, 9, font, GREY);

  // Footer
  text("Thank you for your business — XportACar · info@xportacar.com", M, 40, 8, font, GREY);

  const bytes = await pdf.save();
  const number = inv.invoice_number ?? inv.id.slice(0, 8);
  // Default to INLINE so the PDF previews in the browser / in-app webview (the
  // "View PDF" buttons + the email link). Pass ?download=1 to force a download.
  const disposition = sp.get("download") === "1" ? "attachment" : "inline";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// Simple greedy word-wrap for pdf-lib (no built-in wrapping).
function wrap(s: string, font: import("pdf-lib").PDFFont, size: number, maxW: number): string[] {
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
