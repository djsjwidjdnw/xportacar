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
  subject: string;
  heading: (name: string) => string;
  headingNoName: string;
  bodyHtml: (titleHtml: string) => string;
  noteLabel: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: "Your vehicle has been picked up",
    heading: (name) => `Your vehicle has been picked up, ${name}`,
    headingNoName: "Your vehicle has been picked up",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> has been collected and is being prepared for transport to Europe. We'll keep you updated at each stage of the journey.`,
    noteLabel: "Note from our team",
    ctaLabel: "Track your order",
  },
  de: {
    subject: "Ihr Fahrzeug wurde abgeholt",
    heading: (name) => `Ihr Fahrzeug wurde abgeholt, ${name}`,
    headingNoName: "Ihr Fahrzeug wurde abgeholt",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> wurde abgeholt und wird für den Transport nach Europa vorbereitet. Wir halten Sie bei jedem Schritt auf dem Laufenden.`,
    noteLabel: "Hinweis unseres Teams",
    ctaLabel: "Bestellung verfolgen",
  },
  fr: {
    subject: "Votre véhicule a été enlevé",
    heading: (name) => `Votre véhicule a été enlevé, ${name}`,
    headingNoName: "Votre véhicule a été enlevé",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> a été enlevé et est en cours de préparation pour le transport vers l'Europe. Nous vous tiendrons informé à chaque étape du parcours.`,
    noteLabel: "Note de notre équipe",
    ctaLabel: "Suivre votre commande",
  },
  ar: {
    subject: "تم استلام مركبتك",
    heading: (name) => `تم استلام مركبتك، ${name}`,
    headingNoName: "تم استلام مركبتك",
    bodyHtml: (titleHtml) =>
      `تم استلام <strong>${titleHtml}</strong> ويجري تجهيزها للنقل إلى أوروبا. سنبقيك على اطلاع في كل مرحلة من مراحل الرحلة.`,
    noteLabel: "ملاحظة من فريقنا",
    ctaLabel: "تتبّع طلبك",
  },
};

/** Buyer-facing: their purchased vehicle has been collected for transport. */
export function statusPickedUpEmail(args: {
  name: string;
  vehicleTitle: string;
  note?: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  const titleHtml = escapeHtml(args.vehicleTitle);
  const note = args.note?.trim();
  let bodyHtml = c.bodyHtml(titleHtml);
  if (note) {
    bodyHtml += `<br/><br/><strong>${escapeHtml(c.noteLabel)}:</strong> ${escapeHtml(note)}`;
  }
  return buildEmail({
    subject: c.subject,
    heading: name ? c.heading(name) : c.headingNoName,
    bodyHtml,
    ctaUrl: `${SITE_URL}/dashboard`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
