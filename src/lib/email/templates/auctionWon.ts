import { emailShell, eur, escapeHtml, SITE_URL, type EmailContent } from "./layout";

export function auctionWonEmail(args: {
  amountEur: number;
  auctionId: string;
  invoiceNumber?: string;
}): EmailContent {
  const invoiceLine = args.invoiceNumber
    ? `<br/><br/>Your invoice <strong>${escapeHtml(
        args.invoiceNumber,
      )}</strong> is ready — open the confirmation page to review the total and pay.`
    : `<br/><br/>Open the confirmation page to review your invoice and complete payment.`;
  return {
    subject: "You won the auction!",
    html: emailShell({
      heading: "Congratulations — you won",
      bodyHtml: `Your winning bid of <strong>${eur(
        args.amountEur,
      )}</strong> has been recorded.${invoiceLine}`,
      ctaUrl: `${SITE_URL}/auction/${args.auctionId}/won`,
      ctaLabel: "View confirmation & invoice",
    }),
  };
}
