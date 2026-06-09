import { emailShell, SITE_URL, type EmailContent } from "./layout";

export function welcomeEmail(args: { name: string }): EmailContent {
  const name = args.name?.trim();
  return {
    subject: "Welcome to XportACar",
    html: emailShell({
      heading: name ? `Welcome, ${name}` : "Welcome to XportACar",
      bodyHtml: `Your trade account is live. Browse our inventory of UAE-sourced vehicles bound for Europe and start bidding in live auctions.<br/><br/>
        If you plan to bid, complete your KYC verification from your profile so you're cleared to win and pay.`,
      ctaUrl: `${SITE_URL}/marketplace`,
      ctaLabel: "Browse marketplace",
    }),
  };
}
