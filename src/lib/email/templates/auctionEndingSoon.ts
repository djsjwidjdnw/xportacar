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
  bodyHtml: (titleHtml: string) => string;
  bodyHtmlWithBid: (titleHtml: string, bidHtml: string) => string;
  outbidLine: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (vehicleTitle) => `${vehicleTitle} auction ends in 24 hours`,
    heading: "Auction ending soon",
    bodyHtml: (titleHtml) =>
      `The auction for <strong>${titleHtml}</strong> ends in 24 hours. Place your bid before time runs out.`,
    bodyHtmlWithBid: (titleHtml, bidHtml) =>
      `The auction for <strong>${titleHtml}</strong> ends in 24 hours. The current bid is <strong>${bidHtml}</strong>. Place your bid before time runs out.`,
    outbidLine: "You've been outbid — place a higher bid to stay in.",
    ctaLabel: "View auction",
  },
  de: {
    subject: (vehicleTitle) => `Auktion für ${vehicleTitle} endet in 24 Stunden`,
    heading: "Auktion endet bald",
    bodyHtml: (titleHtml) =>
      `Die Auktion für <strong>${titleHtml}</strong> endet in 24 Stunden. Geben Sie Ihr Gebot ab, bevor die Zeit abläuft.`,
    bodyHtmlWithBid: (titleHtml, bidHtml) =>
      `Die Auktion für <strong>${titleHtml}</strong> endet in 24 Stunden. Das aktuelle Gebot liegt bei <strong>${bidHtml}</strong>. Geben Sie Ihr Gebot ab, bevor die Zeit abläuft.`,
    outbidLine: "Sie wurden überboten — geben Sie ein höheres Gebot ab, um im Rennen zu bleiben.",
    ctaLabel: "Auktion ansehen",
  },
  fr: {
    subject: (vehicleTitle) => `La vente de ${vehicleTitle} se termine dans 24 heures`,
    heading: "La vente se termine bientôt",
    bodyHtml: (titleHtml) =>
      `La vente de <strong>${titleHtml}</strong> se termine dans 24 heures. Placez votre enchère avant la fin du temps imparti.`,
    bodyHtmlWithBid: (titleHtml, bidHtml) =>
      `La vente de <strong>${titleHtml}</strong> se termine dans 24 heures. L'enchère actuelle est de <strong>${bidHtml}</strong>. Placez votre enchère avant la fin du temps imparti.`,
    outbidLine: "Vous avez été surenchéri — placez une enchère plus élevée pour rester dans la course.",
    ctaLabel: "Voir la vente",
  },
  ar: {
    subject: (vehicleTitle) => `مزاد ${vehicleTitle} ينتهي خلال 24 ساعة`,
    heading: "المزاد ينتهي قريبًا",
    bodyHtml: (titleHtml) =>
      `ينتهي مزاد <strong>${titleHtml}</strong> خلال 24 ساعة. قدّم مزايدتك قبل انتهاء الوقت.`,
    bodyHtmlWithBid: (titleHtml, bidHtml) =>
      `ينتهي مزاد <strong>${titleHtml}</strong> خلال 24 ساعة. المزايدة الحالية هي <strong>${bidHtml}</strong>. قدّم مزايدتك قبل انتهاء الوقت.`,
    outbidLine: "تمت المزايدة عليك — قدّم مزايدة أعلى لتبقى في المزاد.",
    ctaLabel: "عرض المزاد",
  },
};

/** Buyer-facing: an auction the buyer is watching/bidding on ends within 24h. */
export function auctionEndingSoonEmail(args: {
  name: string;
  vehicleTitle: string;
  currentBidEur?: number;
  auctionId: string;
  outbid?: boolean;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const titleHtml = escapeHtml(args.vehicleTitle);
  let bodyHtml =
    typeof args.currentBidEur === "number"
      ? c.bodyHtmlWithBid(titleHtml, eur(args.currentBidEur))
      : c.bodyHtml(titleHtml);
  if (args.outbid) {
    bodyHtml += `<br/><br/><strong>${escapeHtml(c.outbidLine)}</strong>`;
  }
  return buildEmail({
    subject: c.subject(args.vehicleTitle),
    heading: c.heading,
    bodyHtml,
    ctaUrl: `${SITE_URL}/auction/${args.auctionId}`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
