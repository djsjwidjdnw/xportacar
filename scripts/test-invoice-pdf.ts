// Standalone render check for the invoice PDF (overlay on the real letterhead).
// Run: npx tsx scripts/test-invoice-pdf.ts
// Loads the letterhead from public/, draws the mock invoice content in the middle,
// writes a PDF, and asserts it is a valid %PDF buffer.
import { writeFileSync, readFileSync } from "node:fs";
import { buildInvoicePdfBytes, type InvoicePdfData } from "../src/lib/invoice/pdfLayout";

const CUSTOMS =
  "All import costs including customs duties and VAT are the responsibility of the buyer and are not included in our fees or shipping costs.";

// Toggle a deliberately long vehicle title to verify wrapping (Task 3).
const LONG_TITLE = process.argv.includes("--long");

async function main() {
  const letterhead = new Uint8Array(readFileSync("public/invoice-letterhead.pdf"));

  const data: InvoicePdfData = {
    number: "XPC-2026-000042",
    statusLabel: "PENDING",
    dateStr: "17 June 2026",
    payDueStr: "24 June 2026",
    confirmByStr: "18 June 2026",
    payByStr: "24 June 2026",
    buyerName: "Chase Bitz",
    buyerSubName: null,
    buyerEmail: "cb@bradshawtrades.com",
    vehicleTitle: LONG_TITLE
      ? "2014 Mercedes-Benz SLS AMG Black Series 2dr Coupe SLS AMG Black Series Edition One Designo"
      : "2014 Mercedes-Benz SLS AMG Black Series",
    vehicleVin: "WDDRJ7HA7EA010686",
    vehicleMileage: "6,000 km",
    lineItems: [
      { label: "Winning hammer bid", amount: 171173 },
      { label: "Platform fee (2.9%)", amount: 4964.02 },
      { label: "Standard Port Shipping", amount: 4500 },
      { label: "German Registration (TÜV)", amount: 3570 },
    ],
    totalEur: 184207.02,
    disclaimer: CUSTOMS,
  };

  const bytes = await buildInvoicePdfBytes(data, letterhead);
  writeFileSync("_invoice_test.pdf", bytes);

  const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
  const kb = (bytes.length / 1024).toFixed(1);
  const ok = header === "%PDF-" && bytes.length > 5000;
  console.log(`PDF magic: ${header} | size: ${kb} KB | bytes: ${bytes.length}`);
  console.log(ok ? "✓ valid PDF buffer" : "✗ INVALID PDF");
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
