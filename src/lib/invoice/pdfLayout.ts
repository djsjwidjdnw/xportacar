// Pure invoice-PDF layout — NO server-only / DB imports, so it can be unit-tested
// and rendered with mock data (see scripts/test-invoice-pdf.ts). The server entry
// `renderInvoicePdf` (pdf.ts) resolves the invoice + pricing, fetches the hero
// photo, then calls buildInvoicePdfBytes() here.
//
// The page reproduces the XPortAcar branded LETTERHEAD (XPortAcar_Final_Letterhead.pdf):
//   • Header  — embedded logo lockup (left) + Dubai address & contact email (right),
//               under a brand-blue separator rule.
//   • Middle  — invoice meta, Bill To, vehicle hero, line items + total, payment
//               instructions, customs notice.
//   • Footer  — EURO (EUR) + AED bank-account blocks over a navy bottom bar.
//
// Everything is drawn imperatively with pdf-lib Helvetica (no fontkit dep), so all
// text is WinAnsi-sanitised via ascii() (ü -> u, non-Latin stripped) exactly as the
// previous generator did.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";

import {
  LETTERHEAD_LOGO_JPEG_BASE64,
  LETTERHEAD_LOGO_W,
  LETTERHEAD_LOGO_H,
} from "./letterheadAssets";

// ─── Letterhead constants (hardcoded, from the letterhead PDF) ──────────────────
const COMPANY = {
  name: "XPortAcar",
  operatedBy: "Operated by Global Business Consultancy L.L.C FZ",
  addressLines: [
    "Meydan Grandstand, 6th Floor,",
    "Meydan Road, Nad Al Sheba,",
    "Dubai, U.A.E.",
  ],
  email: "contact@xportacar.com",
};

// Real receivables (provided by the client). Account Name + Account Holder are the
// same legal entity; both EUR and AED accounts are shown verbatim from the letterhead.
const BANK = {
  accountName: "Global Business Consultancy L.L.C FZ",
  eur: { iban: "AE46 0860 0000 0977 0643 954", swift: "WIOBAEADXXX", currency: "Euro (EUR)" },
  aed: { iban: "AE94 0860 0000 0944 9287 910", swift: "WIOBAEADXXX", currency: "AED (UAE Dirham)" },
};

// ─── Palette (aligned to globals.css / the letterhead blues) ────────────────────
const BRAND = rgb(0.082, 0.439, 0.937); // #1570EF
const BRAND_DK = rgb(0.090, 0.361, 0.827); // #175CD3
const NAVY = rgb(0.043, 0.078, 0.196); // ~#0B1432 (letterhead bottom bar)
const INK = rgb(0.102, 0.129, 0.157); // #1A2128 / grey-900-ish
const GREY = rgb(0.400, 0.451, 0.502); // #667085
const GREY_LT = rgb(0.596, 0.635, 0.702); // #98A2B3
const RULE = rgb(0.918, 0.925, 0.941); // #EAECF0
const RED = rgb(0.851, 0.176, 0.125); // #D92D20
const GREEN = rgb(0.012, 0.596, 0.333); // #039855
const BG_LT = rgb(0.976, 0.980, 0.988); // #F9FAFB
const BRAND_LT = rgb(0.937, 0.973, 1.000); // #EFF8FF
const WHITE = rgb(1, 1, 1);
// EU + UAE flag tints
const EU_BLUE = rgb(0.0, 0.2, 0.6);
const EU_GOLD = rgb(1.0, 0.8, 0.0);
const UAE_RED = rgb(0.808, 0.063, 0.149);
const UAE_GREEN = rgb(0.0, 0.451, 0.235);
const UAE_BLACK = rgb(0, 0, 0);

// ─── Helpers ────────────────────────────────────────────────────────────────────
function eur(n: number): string {
  return "EUR " + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Map common typographic punctuation to ASCII, then strip anything else Helvetica's
// WinAnsi set can't render (ü -> u, é -> stripped, etc.). pdf-lib StandardFonts have
// no Unicode coverage and there is no fontkit dep, so this keeps the PDF renderable.
const ascii = (s: string) =>
  String(s ?? "")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/[‒-―]/g, "-")      // figure/en/em dashes -> hyphen
    .replace(/·/g, "-")               // middot separator -> hyphen
    .replace(/[‘’‚′]/g, "'") // curly single quotes -> '
    .replace(/[“”„″]/g, '"') // curly double quotes -> "
    .replace(/…/g, "...")             // ellipsis
    .replace(/[^\x20-\x7E]/g, "");
function wrap(s: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = ascii(s).split(" ");
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

// ─── Public data contract ───────────────────────────────────────────────────────
export interface InvoiceLineItem { label: string; amount: number }

export interface InvoicePdfData {
  number: string;
  statusLabel: string; // e.g. "PENDING" / "PAID"
  isPaid: boolean;
  dateStr: string;
  payDueStr: string;
  confirmByStr: string;
  payByStr: string;
  buyerName: string;
  buyerSubName?: string | null; // full name when company is the headline name
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerCountry?: string | null;
  vehicleTitle?: string | null;
  vehicleVin?: string | null;
  vehicleMeta?: string | null; // "Black · 42,000 km"
  shippingAddressLines?: string[];
  hero?: { bytes: Uint8Array; isPng: boolean } | null;
  lineItems: InvoiceLineItem[];
  totalEur: number;
  disclaimer: string;
}

/**
 * Render the branded invoice PDF and return the raw bytes. Pure: no DB/network
 * beyond the hero bytes the caller already fetched.
 */
export async function buildInvoicePdfBytes(data: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const W = 595.28, H = 841.89; // A4
  const page = pdf.addPage([W, H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 46;

  const text = (s: string, x: number, yy: number, size = 9, f = font, color = INK) =>
    page.drawText(ascii(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xRight: number, yy: number, size = 9, f = font, color = INK) =>
    page.drawText(ascii(s), { x: xRight - f.widthOfTextAtSize(ascii(s), size), y: yy, size, font: f, color });
  const center = (s: string, cx: number, yy: number, size = 9, f = font, color = INK) =>
    page.drawText(ascii(s), { x: cx - f.widthOfTextAtSize(ascii(s), size) / 2, y: yy, size, font: f, color });

  // ════ HEADER ════════════════════════════════════════════════════════════════
  // Logo lockup (left)
  let logoImg: PDFImage | null = null;
  try { logoImg = await pdf.embedJpg(Buffer.from(LETTERHEAD_LOGO_JPEG_BASE64, "base64")); } catch { logoImg = null; }
  if (logoImg) {
    const logoW = 152;
    const logoH = logoW * (LETTERHEAD_LOGO_H / LETTERHEAD_LOGO_W);
    page.drawImage(logoImg, { x: M, y: H - 24 - logoH, width: logoW, height: logoH });
  } else {
    text("XPortAcar", M, H - 56, 22, bold, BRAND_DK);
    text("EXPORT CARS. CONNECT WORLDS.", M, H - 70, 8, bold, GREY);
  }

  // Address + contact (right). Small drawn icons (location marker + envelope).
  const aIcon = 356, aText = 372;
  let ay = H - 38;
  // location marker: filled brand circle + white centre dot
  page.drawCircle({ x: aIcon + 4, y: ay + 1, size: 3.4, color: BRAND });
  page.drawCircle({ x: aIcon + 4, y: ay + 1.6, size: 1.2, color: WHITE });
  for (const ln of COMPANY.addressLines) { text(ln, aText, ay, 8.5, font, INK); ay -= 11.5; }
  ay -= 4;
  // envelope: rounded rect outline + flap lines
  const ey = ay + 1;
  page.drawRectangle({ x: aIcon, y: ey - 3, width: 10, height: 7, borderColor: BRAND, borderWidth: 1 });
  page.drawLine({ start: { x: aIcon, y: ey + 4 }, end: { x: aIcon + 5, y: ey + 0.5 }, thickness: 0.8, color: BRAND });
  page.drawLine({ start: { x: aIcon + 10, y: ey + 4 }, end: { x: aIcon + 5, y: ey + 0.5 }, thickness: 0.8, color: BRAND });
  text(COMPANY.email, aText, ay, 8.5, font, BRAND_DK);

  // Brand separator rule + navy accent tab (echoes the letterhead).
  const hr = 754;
  page.drawLine({ start: { x: M, y: hr }, end: { x: W - M, y: hr }, thickness: 1.4, color: BRAND });
  page.drawRectangle({ x: W - M - 54, y: hr - 1.5, width: 54, height: 4, color: NAVY });

  // ════ INVOICE TITLE + META ════════════════════════════════════════════════════
  let y = hr - 30;
  text("INVOICE", M, y - 6, 24, bold, BRAND_DK);

  // Meta box (right)
  const mbX = 372, mbR = W - M, mbTop = y + 12, mbBot = y - 52, mbH = mbTop - mbBot;
  page.drawRectangle({ x: mbX, y: mbBot, width: mbR - mbX, height: mbH, color: BG_LT, borderColor: RULE, borderWidth: 1 });
  const metaRow = (label: string, value: string, ry: number, valColor = INK, vf = font) => {
    text(label, mbX + 10, ry, 7.5, bold, GREY);
    right(value, mbR - 10, ry, 9, vf, valColor);
  };
  metaRow("INVOICE #", data.number, mbTop - 15, INK, bold);
  metaRow("DATE", data.dateStr, mbTop - 28);
  metaRow("STATUS", data.statusLabel, mbTop - 41, data.isPaid ? GREEN : BRAND_DK, bold);
  metaRow("PAYMENT DUE", data.payDueStr, mbTop - 54);

  y = mbBot - 22;

  // ════ BILL TO (+ DELIVER TO) ════════════════════════════════════════════════════
  const colR = M + (W - 2 * M) / 2 + 10;
  let ly = y, ry = y;
  text("BILL TO", M, ly, 8, bold, GREY); ly -= 15;
  text(data.buyerName || "—", M, ly, 11, bold, INK); ly -= 13;
  if (data.buyerSubName) { text(data.buyerSubName, M, ly, 9, font, GREY); ly -= 11; }
  if (data.buyerEmail) { text(data.buyerEmail, M, ly, 9, font, GREY); ly -= 11; }
  if (data.buyerPhone) { text(data.buyerPhone, M, ly, 9, font, GREY); ly -= 11; }
  if (data.buyerCountry) { text(data.buyerCountry, M, ly, 9, font, GREY); ly -= 11; }

  if (data.shippingAddressLines && data.shippingAddressLines.length) {
    text("DELIVER TO", colR, ry, 8, bold, GREY); ry -= 15;
    // Cap rendered lines: the footer (bank blocks) is drawn at fixed bottom
    // coordinates, so an unusually long delivery address must not push the body
    // down into it. Line items are bounded (hammer + fee + shipping + at most one
    // TUV extra), so capping this is enough to keep the customs box above y~150.
    const addrLines: string[] = [];
    for (const ln of data.shippingAddressLines.slice(0, 5)) {
      for (const wl of wrap(ln, font, 9, W - M - colR)) addrLines.push(wl);
    }
    for (const wl of addrLines.slice(0, 5)) { text(wl, colR, ry, 9, font, GREY); ry -= 11; }
  }
  y = Math.min(ly, ry) - 16;

  // ════ VEHICLE HERO ════════════════════════════════════════════════════════════
  const photoTop = y;
  let detailX = M;
  let heroImg: PDFImage | null = null;
  if (data.hero) {
    try { heroImg = data.hero.isPng ? await pdf.embedPng(data.hero.bytes) : await pdf.embedJpg(data.hero.bytes); }
    catch { heroImg = null; }
  }
  let heroPh = 0;
  if (heroImg) {
    const pw = 150;
    heroPh = Math.min(100, pw * (heroImg.height / heroImg.width));
    page.drawRectangle({ x: M, y: photoTop - heroPh, width: pw, height: heroPh, borderColor: RULE, borderWidth: 1 });
    page.drawImage(heroImg, { x: M, y: photoTop - heroPh, width: pw, height: heroPh });
    detailX = M + pw + 16;
  }
  let dy = photoTop - 3;
  text("VEHICLE", detailX, dy, 8, bold, GREY); dy -= 15;
  if (data.vehicleTitle) { text(data.vehicleTitle, detailX, dy, 12, bold, INK); dy -= 14; }
  if (data.vehicleVin) { text(`VIN: ${data.vehicleVin}`, detailX, dy, 9, font, GREY); dy -= 12; }
  if (data.vehicleMeta) { text(data.vehicleMeta, detailX, dy, 9, font, GREY); dy -= 12; }
  y = Math.min(photoTop - heroPh, dy) - 18;

  // ════ LINE ITEMS ════════════════════════════════════════════════════════════════
  page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 20, color: BRAND_LT });
  text("DESCRIPTION", M + 10, y + 2, 8, bold, BRAND_DK);
  right("AMOUNT", W - M - 10, y + 2, 8, bold, BRAND_DK);
  y -= 22;
  const line = (label: string, amount: number) => {
    text(label, M + 10, y, 10, font, INK);
    right(eur(amount), W - M - 10, y, 10, font, INK);
    y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: RULE });
    y -= 12;
  };
  for (const it of data.lineItems) line(it.label, it.amount);

  // Total
  y -= 4;
  page.drawRectangle({ x: M, y: y - 10, width: W - 2 * M, height: 26, color: BG_LT, borderColor: RULE, borderWidth: 1 });
  text("TOTAL DUE", M + 10, y, 12, bold, INK);
  right(eur(data.totalEur), W - M - 10, y - 1, 15, bold, BRAND_DK);
  y -= 34;

  // ════ PAYMENT INSTRUCTIONS ════════════════════════════════════════════════════
  text("PAYMENT INSTRUCTIONS", M, y, 8, bold, BRAND_DK); y -= 14;
  text(`Confirm payment within 36 hours of winning — by ${data.confirmByStr}.`, M, y, 9, font, INK); y -= 12;
  text(`Complete the wire transfer within 5 working days of confirming — by ${data.payByStr}.`, M, y, 9, font, INK); y -= 12;
  text(`Use the bank account details below. Payment reference: ${data.number}.`, M, y, 9, font, INK); y -= 18;

  // ════ CUSTOMS NOTICE ════════════════════════════════════════════════════════════
  const discLines = wrap(data.disclaimer, font, 8, W - 2 * M - 14);
  const boxH = discLines.length * 11 + 12;
  page.drawRectangle({ x: M, y: y - boxH + 8, width: W - 2 * M, height: boxH, color: rgb(0.996, 0.949, 0.949) });
  page.drawRectangle({ x: M, y: y - boxH + 8, width: 3, height: boxH, color: RED });
  let cy = y - 2;
  for (const ln of discLines) { text(ln, M + 10, cy, 8, font, rgb(0.55, 0.10, 0.07)); cy -= 11; }

  // ════ FOOTER — bank accounts + navy bar ══════════════════════════════════════════
  drawFooter(page, font, bold, W, M);

  return pdf.save();
}

// Footer is drawn at fixed bottom coordinates regardless of body length.
function drawFooter(
  page: import("pdf-lib").PDFPage,
  font: PDFFont,
  bold: PDFFont,
  W: number,
  M: number,
) {
  const text = (s: string, x: number, yy: number, size = 8, f = font, color = INK) =>
    page.drawText(ascii(s), { x, y: yy, size, font: f, color });

  const usable = W - 2 * M;
  const gap = 26;
  const colW = (usable - gap) / 2;
  const leftX = M;
  const rightX = M + colW + gap;
  const midX = M + colW + gap / 2;

  // Top separator
  page.drawLine({ start: { x: M, y: 138 }, end: { x: W - M, y: 138 }, thickness: 1, color: BRAND });

  // Column headers + flag chips
  drawEuChip(page, leftX, 122);
  text("EURO ACCOUNT (EUR)", leftX + 19, 124, 8, bold, BRAND_DK);
  drawUaeChip(page, rightX, 122);
  text("AED ACCOUNT (AED)", rightX + 19, 124, 8, bold, BRAND_DK);

  // Vertical divider between columns
  page.drawLine({ start: { x: midX, y: 132 }, end: { x: midX, y: 52 }, thickness: 0.75, color: RULE });

  const rowsFor = (acct: { iban: string; swift: string; currency: string }): [string, string][] => ([
    ["Account Name", BANK.accountName],
    ["Account Holder", BANK.accountName],
    ["IBAN", acct.iban],
    ["SWIFT / BIC", acct.swift],
    ["Currency", acct.currency],
  ]);
  const drawCol = (x: number, rows: [string, string][]) => {
    let ry = 108;
    for (const [label, value] of rows) {
      text(label, x, ry, 7.5, bold, GREY);
      text(":", x + 66, ry, 7.5, font, GREY_LT);
      text(value, x + 72, ry, 7.5, font, INK);
      ry -= 11;
    }
  };
  drawCol(leftX, rowsFor(BANK.eur));
  drawCol(rightX, rowsFor(BANK.aed));

  // Navy bottom bar with a brand-blue angled accent (echoes the letterhead).
  page.drawRectangle({ x: 0, y: 0, width: W, height: 18, color: NAVY });
  page.drawSvgPath("M0,0 L150,0 L120,18 L0,18 Z", { x: 0, y: 18, color: BRAND });
}

function drawEuChip(page: import("pdf-lib").PDFPage, x: number, y: number) {
  page.drawRectangle({ x, y, width: 15, height: 10, color: EU_BLUE });
  // ring of stars approximated by small gold dots
  const cx = x + 7.5, cy = y + 5, r = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    page.drawCircle({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.85, size: 0.5, color: EU_GOLD });
  }
}

function drawUaeChip(page: import("pdf-lib").PDFPage, x: number, y: number) {
  // red vertical hoist + green/white/black horizontal stripes
  page.drawRectangle({ x, y, width: 4, height: 10, color: UAE_RED });
  page.drawRectangle({ x: x + 4, y: y + 6.67, width: 11, height: 3.33, color: UAE_GREEN });
  page.drawRectangle({ x: x + 4, y: y + 3.33, width: 11, height: 3.34, color: WHITE });
  page.drawRectangle({ x: x + 4, y, width: 11, height: 3.33, color: UAE_BLACK });
}
