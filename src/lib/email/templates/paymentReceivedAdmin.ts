import { emailShell, escapeHtml, eur, SITE_URL, type EmailContent } from "./layout";

/** Internal alert to admins: a buyer has uploaded payment proof to verify. */
export function paymentReceivedAdminEmail(args: {
  buyerName: string;
  invoiceNumber: string;
  amountEur: number;
  invoiceId: string;
}): EmailContent {
  const buyer = escapeHtml(args.buyerName || "A buyer");
  const inv = escapeHtml(args.invoiceNumber);
  return {
    subject: `Payment proof submitted — ${args.invoiceNumber}`,
    html: emailShell({
      heading: "Payment proof to verify",
      bodyHtml: `<strong>${buyer}</strong> submitted payment proof for invoice <strong>${inv}</strong> (${eur(
        args.amountEur,
      )}). Review the uploaded document and confirm receipt of funds.`,
      ctaUrl: `${SITE_URL}/admin/invoices/${args.invoiceId}`,
      ctaLabel: "Review & verify",
    }),
  };
}
