// Standalone render check for the rebuilt invoice PDF (Task 3).
// Run: npx tsx scripts/test-invoice-pdf.ts
// Imports the PURE layout (no DB / server-only) with mock data, writes a PDF, and
// asserts it is a valid %PDF buffer of a sane size. Then rasterise + eyeball it.
import { writeFileSync, readFileSync } from "node:fs";
import { buildInvoicePdfBytes, type InvoicePdfData } from "../src/lib/invoice/pdfLayout";

const CUSTOMS =
  "All import costs including customs duties and VAT are the responsibility of the buyer and are not included in our fees or shipping costs.";

async function main() {
  // Use the real square logo on disk as a stand-in landscape hero (tests the JPEG embed path).
  const heroBytes = new Uint8Array(readFileSync("public/logos/xportacar-logo.jpg"));

  const data: InvoicePdfData = {
    number: "XPC-2026-000042",
    statusLabel: "PENDING",
    isPaid: false,
    dateStr: "17 June 2026",
    payDueStr: "24 June 2026",
    confirmByStr: "19 June 2026",
    payByStr: "24 June 2026",
    buyerName: "Auto Händler München GmbH", // umlaut -> sanitised to ASCII
    buyerSubName: "Klaus Müller",
    buyerEmail: "klaus@autohandler-muenchen.de",
    buyerPhone: "+49 89 123456",
    buyerCountry: "Germany",
    vehicleTitle: "2021 Mercedes-Benz GLE 400d 4MATIC AMG Line",
    vehicleVin: "WDC1671231A123456",
    vehicleMeta: "Obsidian Black · 42,000 km",
    shippingAddressLines: ["Hauptstrasse 12", "80331 Munich", "DE"],
    hero: { bytes: heroBytes, isPng: false },
    lineItems: [
      { label: "Winning hammer bid", amount: 68500 },
      { label: "Platform fee (2.9%)", amount: 1986.5 },
      { label: "Door-to-Door Delivery (1180 km)", amount: 8630 },
      { label: "German Registration (TÜV)", amount: 3570 },
    ],
    totalEur: 82686.5,
    disclaimer: CUSTOMS,
  };

  const bytes = await buildInvoicePdfBytes(data);
  writeFileSync("_invoice_test.pdf", bytes);

  const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
  const kb = (bytes.length / 1024).toFixed(1);
  const ok = header === "%PDF-" && bytes.length > 5000;
  console.log(`PDF magic: ${header} | size: ${kb} KB | bytes: ${bytes.length}`);
  console.log(ok ? "✓ valid PDF buffer" : "✗ INVALID PDF");
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
