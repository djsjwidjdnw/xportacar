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

// Buyer-facing: a fixed-price purchase went through (buy_now()). The auction
// counterpart, auctionWon.ts, is only sent while bidding is enabled.

type Copy = {
  subject: (titleText: string) => string;
  heading: string;
  body: (titleHtml: string, amountHtml: string) => string;
  nextStep: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (title) => `Purchase confirmed: ${title}`,
    heading: "Your purchase is confirmed",
    body: (titleHtml, amountHtml) =>
      `You bought <strong>${titleHtml}</strong> for <strong>${amountHtml}</strong>. The vehicle is reserved for you and the listing is closed.`,
    nextStep:
      `<br/><br/>Next, open your order to choose shipping and confirm it within 36 hours. Your invoice — vehicle price, 2.9% platform fee and shipping — is emailed to you as soon as you confirm.`,
    ctaLabel: "Open your order",
  },
  de: {
    subject: (title) => `Kauf bestätigt: ${title}`,
    heading: "Ihr Kauf ist bestätigt",
    body: (titleHtml, amountHtml) =>
      `Sie haben <strong>${titleHtml}</strong> für <strong>${amountHtml}</strong> gekauft. Das Fahrzeug ist für Sie reserviert und das Angebot geschlossen.`,
    nextStep:
      `<br/><br/>Öffnen Sie als Nächstes Ihre Bestellung, wählen Sie den Versand und bestätigen Sie innerhalb von 36 Stunden. Ihre Rechnung — Fahrzeugpreis, 2,9 % Plattformgebühr und Versand — erhalten Sie per E-Mail, sobald Sie bestätigen.`,
    ctaLabel: "Bestellung öffnen",
  },
  fr: {
    subject: (title) => `Achat confirmé : ${title}`,
    heading: "Votre achat est confirmé",
    body: (titleHtml, amountHtml) =>
      `Vous avez acheté <strong>${titleHtml}</strong> pour <strong>${amountHtml}</strong>. Le véhicule vous est réservé et l'annonce est close.`,
    nextStep:
      `<br/><br/>Ouvrez ensuite votre commande pour choisir la livraison et la confirmer sous 36 heures. Votre facture — prix du véhicule, commission de 2,9 % et livraison — vous est envoyée par e-mail dès votre confirmation.`,
    ctaLabel: "Ouvrir votre commande",
  },
  ar: {
    subject: (title) => `تم تأكيد الشراء: ${title}`,
    heading: "تم تأكيد عملية الشراء",
    body: (titleHtml, amountHtml) =>
      `لقد اشتريت <strong>${titleHtml}</strong> مقابل <strong>${amountHtml}</strong>. المركبة محجوزة لك وتم إغلاق الإعلان.`,
    nextStep:
      `<br/><br/>الخطوة التالية: افتح طلبك لاختيار الشحن وتأكيده خلال 36 ساعة. ستصلك فاتورتك — سعر المركبة ورسوم المنصة 2.9% والشحن — عبر البريد الإلكتروني فور تأكيدك.`,
    ctaLabel: "فتح طلبك",
  },
};

export function purchaseConfirmedEmail(args: {
  vehicleTitle: string;
  amountEur: number;
  auctionId: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  return buildEmail({
    subject: c.subject(args.vehicleTitle),
    heading: c.heading,
    bodyHtml: `${c.body(escapeHtml(args.vehicleTitle), eur(args.amountEur))}${c.nextStep}`,
    ctaUrl: `${SITE_URL}/auction/${args.auctionId}/won`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
