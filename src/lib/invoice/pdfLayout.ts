// Pure invoice-PDF layout — NO server-only / DB imports, so it can be unit-tested
// and rendered with mock data (see scripts/test-invoice-pdf.ts). The server entry
// `renderInvoicePdf` (pdf.ts) resolves the invoice + pricing and obtains the
// letterhead bytes, then calls buildInvoicePdfBytes() here.
//
// IMPORTANT (per user feedback): the XPortAcar letterhead (public/invoice-letterhead.pdf)
// is a finished, locked brand artifact. We DO NOT redraw its header/footer. We load
// it as the base page and draw ONLY the dynamic invoice content as plain black text
// in the blank middle band (measured at y ~= 170..678 in pdf-lib points). No colours,
// no photo, no custom title styling — the letterhead provides all the branding.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// A4 + the blank middle band of the letterhead (header content ends ~y678, footer
// bank blocks begin ~y169). Keep all drawing inside [TOP_Y .. BOTTOM_Y].
const W = 595.28;
const H = 841.89;
const M = 55;            // left/right text margin
const TOP_Y = 660;       // first baseline (safely below the header)
const BOTTOM_Y = 180;    // never draw below this (stay above the bank footer)
const BLACK = rgb(0, 0, 0);

// Strip non-WinAnsi chars Helvetica can't render; map common punctuation to ASCII
// first (em dash -> hyphen, etc.) so nothing silently vanishes.
const ascii = (s: string) =>
  String(s ?? "")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/[‒-―]/g, "-")
    .replace(/·/g, "-")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");

function eur(n: number): string {
  return "EUR " + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function wrap(s: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = ascii(s).split(" ").filter(Boolean);
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

export interface InvoiceLineItem { label: string; amount: number }

export interface InvoicePdfData {
  number: string;
  statusLabel: string; // e.g. "PENDING" / "PAID"
  dateStr: string;
  payDueStr: string;
  confirmByStr: string;
  payByStr: string;
  buyerName: string;
  buyerSubName?: string | null; // full name when company is the headline name
  buyerEmail?: string | null;
  vehicleTitle?: string | null; // "{year} {make} {model} {trim}" — wraps
  vehicleVin?: string | null;
  vehicleMileage?: string | null; // "6,000 km"
  lineItems: InvoiceLineItem[];
  totalEur: number;
  disclaimer: string;
}

/**
 * Render the invoice PDF: load the letterhead as the base page and overlay the
 * invoice content (plain black text) in its blank middle. If `letterhead` is
 * missing/unreadable, fall back to a blank A4 page so the invoice still generates.
 */
export async function buildInvoicePdfBytes(data: InvoicePdfData, letterhead?: Uint8Array | null): Promise<Uint8Array> {
  let pdf: PDFDocument;
  let page: PDFPage;
  try {
    if (!letterhead) throw new Error("no letterhead");
    pdf = await PDFDocument.load(letterhead);
    page = pdf.getPage(0);
  } catch {
    pdf = await PDFDocument.create();
    page = pdf.addPage([W, H]);
  }

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const text = (s: string, x: number, y: number, size = 10, f = font) =>
    page.drawText(ascii(s), { x, y, size, font: f, color: BLACK });
  const right = (s: string, xRight: number, y: number, size = 10, f = font) =>
    page.drawText(ascii(s), { x: xRight - f.widthOfTextAtSize(ascii(s), size), y, size, font: f, color: BLACK });
  const rule = (y: number) =>
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: BLACK });

  const colW = W - 2 * M; // 485.28
  let y = TOP_Y;

  // ── Invoice metadata ────────────────────────────────────────────────────────
  const meta: [string, string][] = [
    ["INVOICE #:", data.number],
    ["DATE:", data.dateStr],
    ["STATUS:", data.statusLabel],
    ["PAYMENT DUE:", data.payDueStr],
  ];
  for (const [label, value] of meta) {
    text(label, M, y, 10, bold);
    text(value, M + 90, y, 10);
    y -= 15;
  }
  y -= 10;

  // ── Bill To ─────────────────────────────────────────────────────────────────
  text("BILL TO:", M, y, 10, bold); y -= 15;
  for (const ln of wrap(data.buyerName || "-", font, 10, colW)) { text(ln, M, y, 10); y -= 13; }
  if (data.buyerSubName) { for (const ln of wrap(data.buyerSubName, font, 10, colW)) { text(ln, M, y, 10); y -= 13; } }
  if (data.buyerEmail) { for (const ln of wrap(data.buyerEmail, font, 10, colW)) { text(ln, M, y, 10); y -= 13; } }
  y -= 12;

  // ── Vehicle ─────────────────────────────────────────────────────────────────
  text("VEHICLE:", M, y, 10, bold); y -= 15;
  if (data.vehicleTitle) { for (const ln of wrap(data.vehicleTitle, font, 11, colW)) { text(ln, M, y, 11); y -= 14; } }
  if (data.vehicleVin) { text(`VIN: ${data.vehicleVin}`, M, y, 10); y -= 13; }
  if (data.vehicleMileage) { text(data.vehicleMileage, M, y, 10); y -= 13; }
  y -= 14;

  // ── Line items ──────────────────────────────────────────────────────────────
  rule(y); y -= 13;
  text("DESCRIPTION", M, y, 9, bold);
  right("AMOUNT", W - M, y, 9, bold);
  y -= 8;
  rule(y); y -= 15;
  for (const it of data.lineItems) {
    text(it.label, M, y, 10);
    right(eur(it.amount), W - M, y, 10);
    y -= 15;
  }
  y += 2;
  rule(y); y -= 16;
  text("TOTAL DUE", M, y, 11, bold);
  right(eur(data.totalEur), W - M, y, 11, bold);
  y -= 15;
  rule(y); y -= 20;

  // ── Payment instructions ────────────────────────────────────────────────────
  text("PAYMENT INSTRUCTIONS:", M, y, 9, bold); y -= 14;
  const instructions = [
    `Confirm payment within 36 hours of winning — by ${data.confirmByStr}.`,
    `Complete the wire transfer within 5 working days of confirming — by ${data.payByStr}.`,
    `Use the bank account details below. Payment reference: ${data.number}.`,
  ];
  for (const line of instructions) {
    for (const ln of wrap(line, font, 9.5, colW)) { text(ln, M, y, 9.5); y -= 12; }
  }
  y -= 10;

  // ── Customs notice ──────────────────────────────────────────────────────────
  for (const ln of wrap(data.disclaimer, font, 9, colW)) {
    if (y < BOTTOM_Y) break; // never spill into the bank footer
    text(ln, M, y, 9); y -= 12;
  }

  return pdf.save();
}
