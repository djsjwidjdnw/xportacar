import { emailShell, escapeHtml, eur, SITE_URL, type EmailContent } from "./layout";

export function outbidEmail(args: {
  vehicleTitle: string;
  newBidEur: number;
  auctionId: string;
}): EmailContent {
  const title = escapeHtml(args.vehicleTitle);
  return {
    subject: `You've been outbid on ${args.vehicleTitle}`,
    html: emailShell({
      heading: "You've been outbid",
      bodyHtml: `The current top bid on <strong>${title}</strong> is now <strong>${eur(
        args.newBidEur,
      )}</strong>. Place a counter-bid to stay in the auction before it ends.`,
      ctaUrl: `${SITE_URL}/auction/${args.auctionId}`,
      ctaLabel: "Place counter-bid",
    }),
  };
}
