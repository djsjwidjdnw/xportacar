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
  subject: (invoiceNumber: string) => string;
  heading: string;
  fallbackBuyer: string;
  bodyHtml: (buyerHtml: string, invoiceHtml: string, amountHtml: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (invoiceNumber) => `Payment proof submitted — ${invoiceNumber}`,
    heading: "Payment proof to verify",
    fallbackBuyer: "A buyer",
    bodyHtml: (buyerHtml, invoiceHtml, amountHtml) =>
      `<strong>${buyerHtml}</strong> submitted payment proof for invoice <strong>${invoiceHtml}</strong> (${amountHtml}). Review the uploaded document and confirm receipt of funds.`,
    ctaLabel: "Review & verify",
  },
  de: {
    subject: (invoiceNumber) => `Zahlungsnachweis eingereicht — ${invoiceNumber}`,
    heading: "Zu prüfender Zahlungsnachweis",
    fallbackBuyer: "Ein Käufer",
    bodyHtml: (buyerHtml, invoiceHtml, amountHtml) =>
      `<strong>${buyerHtml}</strong> hat einen Zahlungsnachweis für die Rechnung <strong>${invoiceHtml}</strong> (${amountHtml}) eingereicht. Prüfen Sie das hochgeladene Dokument und bestätigen Sie den Zahlungseingang.`,
    ctaLabel: "Prüfen & bestätigen",
  },
  fr: {
    subject: (invoiceNumber) => `Preuve de paiement soumise — ${invoiceNumber}`,
    heading: "Preuve de paiement à vérifier",
    fallbackBuyer: "Un acheteur",
    bodyHtml: (buyerHtml, invoiceHtml, amountHtml) =>
      `<strong>${buyerHtml}</strong> a soumis une preuve de paiement pour la facture <strong>${invoiceHtml}</strong> (${amountHtml}). Examinez le document téléversé et confirmez la réception des fonds.`,
    ctaLabel: "Examiner et vérifier",
  },
  ar: {
    subject: (invoiceNumber) => `تم تقديم إثبات الدفع — ${invoiceNumber}`,
    heading: "إثبات دفع بحاجة إلى التحقق",
    fallbackBuyer: "أحد المشترين",
    bodyHtml: (buyerHtml, invoiceHtml, amountHtml) =>
      `قدّم <strong>${buyerHtml}</strong> إثبات دفع للفاتورة <strong>${invoiceHtml}</strong> (${amountHtml}). راجع المستند المرفوع وأكّد استلام الأموال.`,
    ctaLabel: "المراجعة والتحقق",
  },
};

/** Internal alert to admins: a buyer has uploaded payment proof to verify. */
export function paymentReceivedAdminEmail(args: {
  buyerName: string;
  invoiceNumber: string;
  amountEur: number;
  invoiceId: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const buyer = escapeHtml(args.buyerName || c.fallbackBuyer);
  const inv = escapeHtml(args.invoiceNumber);
  return buildEmail({
    subject: c.subject(args.invoiceNumber),
    heading: c.heading,
    bodyHtml: c.bodyHtml(buyer, inv, eur(args.amountEur)),
    ctaUrl: `${SITE_URL}/admin/invoices/${args.invoiceId}`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
