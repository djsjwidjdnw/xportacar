import { emailShell, escapeHtml, SITE_URL, type EmailContent } from "./layout";

export function kycRejectedEmail(args: { name: string; reason: string }): EmailContent {
  const name = args.name?.trim();
  const reason = args.reason?.trim();
  const reasonBlock = reason
    ? `<br/><br/><strong>Reason:</strong> ${escapeHtml(reason)}`
    : "";
  return {
    subject: "Action needed: your KYC submission",
    html: emailShell({
      heading: name ? `${name}, we couldn't verify your documents` : "We couldn't verify your documents",
      bodyHtml: `Your KYC submission was not approved this time.${reasonBlock}<br/><br/>Please re-upload corrected documents from your profile and we'll review them again.`,
      ctaUrl: `${SITE_URL}/profile`,
      ctaLabel: "Re-submit documents",
    }),
  };
}
