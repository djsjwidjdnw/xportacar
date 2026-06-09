import { emailShell, SITE_URL, type EmailContent } from "./layout";

export function kycApprovedEmail(args: { name: string }): EmailContent {
  const name = args.name?.trim();
  return {
    subject: "Your XportACar account is verified",
    html: emailShell({
      heading: name ? `You're verified, ${name}` : "You're verified",
      bodyHtml: `Your KYC documents have been approved. Your account is now fully cleared to bid, win, and pay for vehicles on XportACar.`,
      ctaUrl: `${SITE_URL}/marketplace`,
      ctaLabel: "Start bidding",
    }),
  };
}
