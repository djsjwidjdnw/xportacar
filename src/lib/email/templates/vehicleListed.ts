import { emailShell, escapeHtml, SITE_URL, type EmailContent } from "./layout";

/**
 * Seller-facing: their vehicle is now listed. Sellers aren't active users yet,
 * so this template is prepped for when seller accounts go live.
 */
export function vehicleListedEmail(args: {
  sellerName: string;
  vehicleTitle: string;
  vehicleId?: string;
}): EmailContent {
  const seller = escapeHtml(args.sellerName || "there");
  const title = escapeHtml(args.vehicleTitle);
  return {
    subject: `Your ${args.vehicleTitle} is now listed on XportACar`,
    html: emailShell({
      heading: "Your vehicle is live",
      bodyHtml: `Hi ${seller}, your <strong>${title}</strong> has been listed on XportACar and is now visible to European trade buyers. We'll notify you when bidding opens and when it sells.`,
      ctaUrl: args.vehicleId ? `${SITE_URL}/vehicle/${args.vehicleId}` : `${SITE_URL}/marketplace`,
      ctaLabel: "View listing",
    }),
  };
}
