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
  subject: (amount: string, vehicleTitle: string) => string;
  heading: string;
  bodyHtml: (amountHtml: string, titleHtml: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (amount, vehicleTitle) => `Bid placed: ${amount} on ${vehicleTitle}`,
    heading: "Bid confirmed",
    bodyHtml: (amountHtml, titleHtml) =>
      `We've recorded your bid of <strong>${amountHtml}</strong> on <strong>${titleHtml}</strong>. We'll email you if you're outbid.`,
    ctaLabel: "Open auction",
  },
  de: {
    subject: (amount, vehicleTitle) => `Gebot abgegeben: ${amount} auf ${vehicleTitle}`,
    heading: "Gebot bestätigt",
    bodyHtml: (amountHtml, titleHtml) =>
      `Wir haben Ihr Gebot von <strong>${amountHtml}</strong> auf <strong>${titleHtml}</strong> erfasst. Wir benachrichtigen Sie per E-Mail, falls Sie überboten werden.`,
    ctaLabel: "Auktion öffnen",
  },
  fr: {
    subject: (amount, vehicleTitle) => `Enchère placée : ${amount} sur ${vehicleTitle}`,
    heading: "Enchère confirmée",
    bodyHtml: (amountHtml, titleHtml) =>
      `Nous avons enregistré votre enchère de <strong>${amountHtml}</strong> sur <strong>${titleHtml}</strong>. Nous vous enverrons un e-mail si vous êtes surenchéri.`,
    ctaLabel: "Ouvrir la vente",
  },
  ar: {
    subject: (amount, vehicleTitle) => `تم تقديم المزايدة: ${amount} على ${vehicleTitle}`,
    heading: "تم تأكيد المزايدة",
    bodyHtml: (amountHtml, titleHtml) =>
      `سجّلنا مزايدتك بقيمة <strong>${amountHtml}</strong> على <strong>${titleHtml}</strong>. سنرسل لك بريدًا إلكترونيًا إذا تمت المزايدة عليك.`,
    ctaLabel: "فتح المزاد",
  },
};

export function bidConfirmationEmail(args: {
  vehicleTitle: string;
  amountEur: number;
  auctionId: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const amount = eur(args.amountEur);
  return buildEmail({
    subject: c.subject(amount, args.vehicleTitle),
    heading: c.heading,
    bodyHtml: c.bodyHtml(amount, escapeHtml(args.vehicleTitle)),
    ctaUrl: `${SITE_URL}/auction/${args.auctionId}`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
