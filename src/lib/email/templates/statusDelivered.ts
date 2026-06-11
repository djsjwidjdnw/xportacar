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
    subject: "Your vehicle has been delivered",
    heading: (name) => `Your vehicle has been delivered, ${name}`,
    headingNoName: "Your vehicle has been delivered",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> has arrived and been delivered. Thank you for buying with XportACar — we hope to see you in our next auction cycle.`,
    noteLabel: "Note from our team",
    ctaLabel: "View your order",
  },
  de: {
    subject: "Ihr Fahrzeug wurde geliefert",
    heading: (name) => `Ihr Fahrzeug wurde geliefert, ${name}`,
    headingNoName: "Ihr Fahrzeug wurde geliefert",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> ist angekommen und wurde geliefert. Vielen Dank für Ihren Kauf bei XportACar — wir freuen uns, Sie beim nächsten Auktionszyklus wiederzusehen.`,
    noteLabel: "Hinweis unseres Teams",
    ctaLabel: "Bestellung ansehen",
  },
  fr: {
    subject: "Votre véhicule a été livré",
    heading: (name) => `Votre véhicule a été livré, ${name}`,
    headingNoName: "Votre véhicule a été livré",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> est arrivé et a été livré. Merci d'avoir acheté avec XportACar — nous espérons vous revoir lors de notre prochain cycle d'enchères.`,
    noteLabel: "Note de notre équipe",
    ctaLabel: "Voir votre commande",
  },
  ar: {
    subject: "تم تسليم مركبتك",
    heading: (name) => `تم تسليم مركبتك، ${name}`,
    headingNoName: "تم تسليم مركبتك",
    bodyHtml: (titleHtml) =>
      `وصلت <strong>${titleHtml}</strong> وتم تسليمها. شكرًا لشرائك عبر XportACar — نتطلّع إلى رؤيتك في دورة المزاد القادمة.`,
    noteLabel: "ملاحظة من فريقنا",
    ctaLabel: "عرض طلبك",
  },
};

/** Buyer-facing: their purchased vehicle has been delivered. */
export function statusDeliveredEmail(args: {
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
