import {
  buildEmail,
  escapeHtml,
  pickLocale,
  SITE_URL,
  type EmailContent,
  type EmailLocale,
  type Localized,
} from "./layout";

type Copy = {
  subject: (vehicleTitle: string) => string;
  heading: string;
  fallbackSeller: string;
  bodyHtml: (sellerHtml: string, titleHtml: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (vehicleTitle) => `Your ${vehicleTitle} is now listed on XportACar`,
    heading: "Your vehicle is live",
    fallbackSeller: "there",
    bodyHtml: (sellerHtml, titleHtml) =>
      `Hi ${sellerHtml}, your <strong>${titleHtml}</strong> has been listed on XportACar and is now visible to European trade buyers. We'll notify you when bidding opens and when it sells.`,
    ctaLabel: "View listing",
  },
  de: {
    subject: (vehicleTitle) => `Ihr ${vehicleTitle} ist jetzt auf XportACar gelistet`,
    heading: "Ihr Fahrzeug ist online",
    fallbackSeller: "Hallo",
    bodyHtml: (sellerHtml, titleHtml) =>
      `Hallo ${sellerHtml}, Ihr <strong>${titleHtml}</strong> wurde auf XportACar gelistet und ist nun für europäische Händler sichtbar. Wir benachrichtigen Sie, wenn die Gebotsphase beginnt und wenn das Fahrzeug verkauft wird.`,
    ctaLabel: "Inserat ansehen",
  },
  fr: {
    subject: (vehicleTitle) => `Votre ${vehicleTitle} est maintenant en ligne sur XportACar`,
    heading: "Votre véhicule est en ligne",
    fallbackSeller: "à vous",
    bodyHtml: (sellerHtml, titleHtml) =>
      `Bonjour ${sellerHtml}, votre <strong>${titleHtml}</strong> a été mis en ligne sur XportACar et est désormais visible par les acheteurs professionnels européens. Nous vous préviendrons à l'ouverture des enchères et lors de la vente.`,
    ctaLabel: "Voir l'annonce",
  },
  ar: {
    subject: (vehicleTitle) => `سيارتك ${vehicleTitle} أصبحت معروضة الآن على XportACar`,
    heading: "مركبتك أصبحت متاحة",
    fallbackSeller: "مرحبًا",
    bodyHtml: (sellerHtml, titleHtml) =>
      `مرحبًا ${sellerHtml}، تم إدراج سيارتك <strong>${titleHtml}</strong> على XportACar وأصبحت الآن مرئية للمشترين التجاريين في أوروبا. سنبلغك عند فتح باب المزايدة وعند بيعها.`,
    ctaLabel: "عرض الإعلان",
  },
};

/**
 * Seller-facing: their vehicle is now listed. Sellers aren't active users yet,
 * so this template is prepped for when seller accounts go live.
 */
export function vehicleListedEmail(args: {
  sellerName: string;
  vehicleTitle: string;
  vehicleId?: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const seller = escapeHtml(args.sellerName || c.fallbackSeller);
  const title = escapeHtml(args.vehicleTitle);
  return buildEmail({
    subject: c.subject(args.vehicleTitle),
    heading: c.heading,
    bodyHtml: c.bodyHtml(seller, title),
    ctaUrl: args.vehicleId ? `${SITE_URL}/vehicle/${args.vehicleId}` : `${SITE_URL}/marketplace`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
