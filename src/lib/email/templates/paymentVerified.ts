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
  heading: (name: string) => string;
  headingNoName: string;
  bodyHtml: (amountHtml: string, invoiceHtml: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (invoiceNumber) => `Payment confirmed — ${invoiceNumber}`,
    heading: (name) => `Payment received, ${name}`,
    headingNoName: "Payment received",
    bodyHtml: (amountHtml, invoiceHtml) =>
      `We've confirmed your payment of <strong>${amountHtml}</strong> for invoice <strong>${invoiceHtml}</strong>. Our team will be in touch about collection and shipping to Europe.`,
    ctaLabel: "View order",
  },
  de: {
    subject: (invoiceNumber) => `Zahlung bestätigt — ${invoiceNumber}`,
    heading: (name) => `Zahlung erhalten, ${name}`,
    headingNoName: "Zahlung erhalten",
    bodyHtml: (amountHtml, invoiceHtml) =>
      `Wir haben Ihre Zahlung von <strong>${amountHtml}</strong> für die Rechnung <strong>${invoiceHtml}</strong> bestätigt. Unser Team meldet sich bei Ihnen zur Abholung und zum Versand nach Europa.`,
    ctaLabel: "Bestellung ansehen",
  },
  fr: {
    subject: (invoiceNumber) => `Paiement confirmé — ${invoiceNumber}`,
    heading: (name) => `Paiement reçu, ${name}`,
    headingNoName: "Paiement reçu",
    bodyHtml: (amountHtml, invoiceHtml) =>
      `Nous avons confirmé votre paiement de <strong>${amountHtml}</strong> pour la facture <strong>${invoiceHtml}</strong>. Notre équipe vous contactera concernant l'enlèvement et l'expédition vers l'Europe.`,
    ctaLabel: "Voir la commande",
  },
  ar: {
    subject: (invoiceNumber) => `تم تأكيد الدفع — ${invoiceNumber}`,
    heading: (name) => `تم استلام الدفع، ${name}`,
    headingNoName: "تم استلام الدفع",
    bodyHtml: (amountHtml, invoiceHtml) =>
      `لقد أكّدنا دفعتك بقيمة <strong>${amountHtml}</strong> للفاتورة <strong>${invoiceHtml}</strong>. سيتواصل معك فريقنا بشأن الاستلام والشحن إلى أوروبا.`,
    ctaLabel: "عرض الطلب",
  },
};

/** Buyer-facing: admin has confirmed the payment was received. */
export function paymentVerifiedEmail(args: {
  name: string;
  invoiceNumber: string;
  amountEur: number;
  auctionId?: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  const inv = escapeHtml(args.invoiceNumber);
  return buildEmail({
    subject: c.subject(args.invoiceNumber),
    heading: name ? c.heading(name) : c.headingNoName,
    bodyHtml: c.bodyHtml(eur(args.amountEur), inv),
    ctaUrl: args.auctionId ? `${SITE_URL}/auction/${args.auctionId}/won` : `${SITE_URL}/dashboard`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
