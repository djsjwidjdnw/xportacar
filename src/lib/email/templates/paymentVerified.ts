import { emailShell, escapeHtml, eur, SITE_URL, type EmailContent } from "./layout";

/** Buyer-facing: admin has confirmed the payment was received. */
export function paymentVerifiedEmail(args: {
  name: string;
  invoiceNumber: string;
  amountEur: number;
  auctionId?: string;
}): EmailContent {
  const name = args.name?.trim();
  const inv = escapeHtml(args.invoiceNumber);
  return {
    subject: `Payment confirmed — ${args.invoiceNumber}`,
    html: emailShell({
      heading: name ? `Payment received, ${name}` : "Payment received",
      bodyHtml: `We've confirmed your payment of <strong>${eur(
        args.amountEur,
      )}</strong> for invoice <strong>${inv}</strong>. Our team will be in touch about collection and shipping to Europe.`,
      ctaUrl: args.auctionId ? `${SITE_URL}/auction/${args.auctionId}/won` : `${SITE_URL}/dashboard`,
      ctaLabel: "View order",
    }),
  };
}
