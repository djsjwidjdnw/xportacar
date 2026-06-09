import { emailShell, escapeHtml, eur, SITE_URL, type EmailContent } from "./layout";

export function bidConfirmationEmail(args: {
  vehicleTitle: string;
  amountEur: number;
  auctionId: string;
}): EmailContent {
  const title = escapeHtml(args.vehicleTitle);
  return {
    subject: `Bid placed: ${eur(args.amountEur)} on ${args.vehicleTitle}`,
    html: emailShell({
      heading: "Bid confirmed",
      bodyHtml: `We've recorded your bid of <strong>${eur(
        args.amountEur,
      )}</strong> on <strong>${title}</strong>. We'll email you if you're outbid.`,
      ctaUrl: `${SITE_URL}/auction/${args.auctionId}`,
      ctaLabel: "Open auction",
    }),
  };
}
