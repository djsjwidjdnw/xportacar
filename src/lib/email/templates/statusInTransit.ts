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
  bodyHtmlWithDestination: (titleHtml: string, destinationHtml: string) => string;
  noteLabel: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: "Your vehicle is in transit",
    heading: (name) => `Your vehicle is in transit, ${name}`,
    headingNoName: "Your vehicle is in transit",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> is now on its way to Europe. We'll let you know as soon as it arrives and is ready for delivery.`,
    bodyHtmlWithDestination: (titleHtml, destinationHtml) =>
      `<strong>${titleHtml}</strong> is now on its way to <strong>${destinationHtml}</strong>. We'll let you know as soon as it arrives and is ready for delivery.`,
    noteLabel: "Note from our team",
    ctaLabel: "Track your order",
  },
  de: {
    subject: "Ihr Fahrzeug ist unterwegs",
    heading: (name) => `Ihr Fahrzeug ist unterwegs, ${name}`,
    headingNoName: "Ihr Fahrzeug ist unterwegs",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> ist jetzt auf dem Weg nach Europa. Wir informieren Sie, sobald es ankommt und zur Auslieferung bereit ist.`,
    bodyHtmlWithDestination: (titleHtml, destinationHtml) =>
      `<strong>${titleHtml}</strong> ist jetzt auf dem Weg nach <strong>${destinationHtml}</strong>. Wir informieren Sie, sobald es ankommt und zur Auslieferung bereit ist.`,
    noteLabel: "Hinweis unseres Teams",
    ctaLabel: "Bestellung verfolgen",
  },
  fr: {
    subject: "Votre véhicule est en transit",
    heading: (name) => `Votre véhicule est en transit, ${name}`,
    headingNoName: "Votre véhicule est en transit",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> est maintenant en route vers l'Europe. Nous vous préviendrons dès son arrivée et lorsqu'il sera prêt à être livré.`,
    bodyHtmlWithDestination: (titleHtml, destinationHtml) =>
      `<strong>${titleHtml}</strong> est maintenant en route vers <strong>${destinationHtml}</strong>. Nous vous préviendrons dès son arrivée et lorsqu'il sera prêt à être livré.`,
    noteLabel: "Note de notre équipe",
    ctaLabel: "Suivre votre commande",
  },
  ar: {
    subject: "مركبتك في طريقها إليك",
    heading: (name) => `مركبتك في طريقها إليك، ${name}`,
    headingNoName: "مركبتك في طريقها إليك",
    bodyHtml: (titleHtml) =>
      `<strong>${titleHtml}</strong> الآن في طريقها إلى أوروبا. سنبلغك فور وصولها واستعدادها للتسليم.`,
    bodyHtmlWithDestination: (titleHtml, destinationHtml) =>
      `<strong>${titleHtml}</strong> الآن في طريقها إلى <strong>${destinationHtml}</strong>. سنبلغك فور وصولها واستعدادها للتسليم.`,
    noteLabel: "ملاحظة من فريقنا",
    ctaLabel: "تتبّع طلبك",
  },
};

/** Buyer-facing: their purchased vehicle has shipped and is in transit. */
export function statusInTransitEmail(args: {
  name: string;
  vehicleTitle: string;
  destination?: string;
  note?: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  const titleHtml = escapeHtml(args.vehicleTitle);
  const destination = args.destination?.trim();
  let bodyHtml = destination
    ? c.bodyHtmlWithDestination(titleHtml, escapeHtml(destination))
    : c.bodyHtml(titleHtml);
  const note = args.note?.trim();
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
