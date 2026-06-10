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
  heading: string;
  bodyHtml: (titleHtml: string, bidHtml: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (vehicleTitle) => `You've been outbid on ${vehicleTitle}`,
    heading: "You've been outbid",
    bodyHtml: (titleHtml, bidHtml) =>
      `The current top bid on <strong>${titleHtml}</strong> is now <strong>${bidHtml}</strong>. Place a counter-bid to stay in the auction before it ends.`,
    ctaLabel: "Place counter-bid",
  },
  de: {
    subject: (vehicleTitle) => `Sie wurden bei ${vehicleTitle} überboten`,
    heading: "Sie wurden überboten",
    bodyHtml: (titleHtml, bidHtml) =>
      `Das aktuelle Höchstgebot für <strong>${titleHtml}</strong> liegt jetzt bei <strong>${bidHtml}</strong>. Geben Sie ein Gegengebot ab, um vor Ablauf der Auktion im Rennen zu bleiben.`,
    ctaLabel: "Gegengebot abgeben",
  },
  fr: {
    subject: (vehicleTitle) => `Vous avez été surenchéri sur ${vehicleTitle}`,
    heading: "Vous avez été surenchéri",
    bodyHtml: (titleHtml, bidHtml) =>
      `La meilleure enchère actuelle sur <strong>${titleHtml}</strong> est désormais de <strong>${bidHtml}</strong>. Placez une contre-enchère pour rester dans la vente avant sa clôture.`,
    ctaLabel: "Placer une contre-enchère",
  },
  ar: {
    subject: (vehicleTitle) => `تمت المزايدة عليك في ${vehicleTitle}`,
    heading: "تمت المزايدة عليك",
    bodyHtml: (titleHtml, bidHtml) =>
      `أصبحت أعلى مزايدة حالية على <strong>${titleHtml}</strong> الآن <strong>${bidHtml}</strong>. قدّم مزايدة مضادة لتبقى في المزاد قبل انتهائه.`,
    ctaLabel: "تقديم مزايدة مضادة",
  },
};

export function outbidEmail(args: {
  vehicleTitle: string;
  newBidEur: number;
  auctionId: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const titleHtml = escapeHtml(args.vehicleTitle);
  const bidHtml = eur(args.newBidEur);
  return buildEmail({
    subject: c.subject(args.vehicleTitle),
    heading: c.heading,
    bodyHtml: c.bodyHtml(titleHtml, bidHtml),
    ctaUrl: `${SITE_URL}/auction/${args.auctionId}`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
