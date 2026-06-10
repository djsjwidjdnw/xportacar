import {
  buildEmail,
  escapeHtml,
  eur,
  pickLocale,
  SITE_URL,
  type EmailContent,
  type EmailLocale,
  type Localized,
} from "./layout";

type Copy = {
  subject: string;
  heading: string;
  body: (amountHtml: string) => string;
  invoiceLine: (invoiceHtml: string) => string;
  noInvoiceLine: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: "You won the auction!",
    heading: "Congratulations — you won",
    body: (amountHtml) => `Your winning bid of <strong>${amountHtml}</strong> has been recorded.`,
    invoiceLine: (invoiceHtml) =>
      `<br/><br/>Your invoice <strong>${invoiceHtml}</strong> is ready — open the confirmation page to review the total and pay.`,
    noInvoiceLine: `<br/><br/>Open the confirmation page to review your invoice and complete payment.`,
    ctaLabel: "View confirmation & invoice",
  },
  de: {
    subject: "Sie haben die Auktion gewonnen!",
    heading: "Glückwunsch — Sie haben gewonnen",
    body: (amountHtml) => `Ihr Gewinngebot von <strong>${amountHtml}</strong> wurde erfasst.`,
    invoiceLine: (invoiceHtml) =>
      `<br/><br/>Ihre Rechnung <strong>${invoiceHtml}</strong> ist bereit — öffnen Sie die Bestätigungsseite, um den Gesamtbetrag zu prüfen und zu bezahlen.`,
    noInvoiceLine: `<br/><br/>Öffnen Sie die Bestätigungsseite, um Ihre Rechnung zu prüfen und die Zahlung abzuschließen.`,
    ctaLabel: "Bestätigung & Rechnung ansehen",
  },
  fr: {
    subject: "Vous avez remporté la vente !",
    heading: "Félicitations — vous avez gagné",
    body: (amountHtml) => `Votre enchère gagnante de <strong>${amountHtml}</strong> a été enregistrée.`,
    invoiceLine: (invoiceHtml) =>
      `<br/><br/>Votre facture <strong>${invoiceHtml}</strong> est prête — ouvrez la page de confirmation pour vérifier le total et payer.`,
    noInvoiceLine: `<br/><br/>Ouvrez la page de confirmation pour consulter votre facture et finaliser le paiement.`,
    ctaLabel: "Voir la confirmation et la facture",
  },
  ar: {
    subject: "لقد فزت بالمزاد!",
    heading: "تهانينا — لقد فزت",
    body: (amountHtml) => `تم تسجيل مزايدتك الفائزة بقيمة <strong>${amountHtml}</strong>.`,
    invoiceLine: (invoiceHtml) =>
      `<br/><br/>فاتورتك <strong>${invoiceHtml}</strong> جاهزة — افتح صفحة التأكيد لمراجعة الإجمالي والدفع.`,
    noInvoiceLine: `<br/><br/>افتح صفحة التأكيد لمراجعة فاتورتك وإتمام الدفع.`,
    ctaLabel: "عرض التأكيد والفاتورة",
  },
};

export function auctionWonEmail(args: {
  amountEur: number;
  auctionId: string;
  invoiceNumber?: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const invoiceLine = args.invoiceNumber
    ? c.invoiceLine(escapeHtml(args.invoiceNumber))
    : c.noInvoiceLine;
  return buildEmail({
    subject: c.subject,
    heading: c.heading,
    bodyHtml: `${c.body(eur(args.amountEur))}${invoiceLine}`,
    ctaUrl: `${SITE_URL}/auction/${args.auctionId}/won`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
