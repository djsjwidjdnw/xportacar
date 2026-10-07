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
  subject: (vehicleTitle: string) => string;
  heading: (name: string) => string;
  headingNoName: string;
  bodyHtml: (titleHtml: string) => string;
  bodyHtmlWithPrice: (titleHtml: string, priceHtml: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (vehicleTitle) => `New car matches your watchlist: ${vehicleTitle}`,
    heading: (name) => `A new match for you, ${name}`,
    headingNoName: "A new match for your watchlist",
    bodyHtml: (titleHtml) =>
      `A vehicle matching your watchlist preferences has just been listed: <strong>${titleHtml}</strong>. Take a look before it sells.`,
    bodyHtmlWithPrice: (titleHtml, priceHtml) =>
      `A vehicle matching your watchlist preferences has just been listed: <strong>${titleHtml}</strong>, listed at <strong>${priceHtml}</strong>. Take a look before it sells.`,
    ctaLabel: "View vehicle",
  },
  de: {
    subject: (vehicleTitle) => `Neues Fahrzeug passt zu Ihrer Merkliste: ${vehicleTitle}`,
    heading: (name) => `Ein neuer Treffer für Sie, ${name}`,
    headingNoName: "Ein neuer Treffer für Ihre Merkliste",
    bodyHtml: (titleHtml) =>
      `Ein Fahrzeug, das zu Ihren Merklisten-Präferenzen passt, wurde gerade eingestellt: <strong>${titleHtml}</strong>. Werfen Sie einen Blick darauf, bevor es verkauft ist.`,
    bodyHtmlWithPrice: (titleHtml, priceHtml) =>
      `Ein Fahrzeug, das zu Ihren Merklisten-Präferenzen passt, wurde gerade eingestellt: <strong>${titleHtml}</strong>, zum Festpreis von <strong>${priceHtml}</strong>. Werfen Sie einen Blick darauf, bevor es verkauft ist.`,
    ctaLabel: "Fahrzeug ansehen",
  },
  fr: {
    subject: (vehicleTitle) => `Un nouveau véhicule correspond à votre liste de suivi : ${vehicleTitle}`,
    heading: (name) => `Une nouvelle correspondance pour vous, ${name}`,
    headingNoName: "Une nouvelle correspondance pour votre liste de suivi",
    bodyHtml: (titleHtml) =>
      `Un véhicule correspondant à vos préférences de liste de suivi vient d'être mis en ligne : <strong>${titleHtml}</strong>. Jetez-y un œil avant qu'il ne soit vendu.`,
    bodyHtmlWithPrice: (titleHtml, priceHtml) =>
      `Un véhicule correspondant à vos préférences de liste de suivi vient d'être mis en ligne : <strong>${titleHtml}</strong>, proposé à <strong>${priceHtml}</strong>. Jetez-y un œil avant qu'il ne soit vendu.`,
    ctaLabel: "Voir le véhicule",
  },
  ar: {
    subject: (vehicleTitle) => `سيارة جديدة تطابق قائمة متابعتك: ${vehicleTitle}`,
    heading: (name) => `تطابق جديد من أجلك، ${name}`,
    headingNoName: "تطابق جديد لقائمة متابعتك",
    bodyHtml: (titleHtml) =>
      `تم للتو إدراج مركبة تطابق تفضيلات قائمة متابعتك: <strong>${titleHtml}</strong>. ألقِ نظرة عليها قبل أن تُباع.`,
    bodyHtmlWithPrice: (titleHtml, priceHtml) =>
      `تم للتو إدراج مركبة تطابق تفضيلات قائمة متابعتك: <strong>${titleHtml}</strong>، معروضة بسعر <strong>${priceHtml}</strong>. ألقِ نظرة عليها قبل أن تُباع.`,
    ctaLabel: "عرض المركبة",
  },
};

/** Buyer-facing: a newly listed vehicle matches the buyer's watchlist. */
export function watchlistMatchEmail(args: {
  name: string;
  vehicleTitle: string;
  priceEur?: number;
  vehicleId: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  const titleHtml = escapeHtml(args.vehicleTitle);
  const bodyHtml =
    typeof args.priceEur === "number"
      ? c.bodyHtmlWithPrice(titleHtml, eur(args.priceEur))
      : c.bodyHtml(titleHtml);
  return buildEmail({
    subject: c.subject(args.vehicleTitle),
    heading: name ? c.heading(name) : c.headingNoName,
    bodyHtml,
    ctaUrl: `${SITE_URL}/vehicle/${args.vehicleId}`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
