import {
  buildEmail, escapeHtml, pickLocale,
  type EmailContent, type EmailLocale, type Localized,
} from "./layout";

type Copy = {
  subject: string;
  heading: string;
  body: (dateStr: string) => string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: "Your XportACar account has been deleted",
    heading: "Account deleted",
    body: (d) =>
      `Your XportACar account was deleted on <strong>${d}</strong>. All your data has been removed from our systems, except for legally required financial records (invoices), which have been anonymized.<br/><br/>We're sorry to see you go. You're welcome back any time.`,
  },
  de: {
    subject: "Ihr XportACar-Konto wurde gelöscht",
    heading: "Konto gelöscht",
    body: (d) =>
      `Ihr XportACar-Konto wurde am <strong>${d}</strong> gelöscht. Alle Ihre Daten wurden aus unseren Systemen entfernt — ausgenommen gesetzlich vorgeschriebene Finanzunterlagen (Rechnungen), die anonymisiert wurden.<br/><br/>Schade, dass Sie gehen. Sie sind jederzeit wieder willkommen.`,
  },
  fr: {
    subject: "Votre compte XportACar a été supprimé",
    heading: "Compte supprimé",
    body: (d) =>
      `Votre compte XportACar a été supprimé le <strong>${d}</strong>. Toutes vos données ont été retirées de nos systèmes, à l'exception des documents financiers exigés par la loi (factures), qui ont été anonymisés.<br/><br/>Nous sommes désolés de vous voir partir. Vous êtes le/la bienvenu(e) à tout moment.`,
  },
  ar: {
    subject: "تم حذف حسابك في XportACar",
    heading: "تم حذف الحساب",
    body: (d) =>
      `تم حذف حسابك في XportACar بتاريخ <strong>${d}</strong>. تمت إزالة جميع بياناتك من أنظمتنا، باستثناء السجلات المالية المطلوبة قانونًا (الفواتير) التي تم إخفاء هويتها.<br/><br/>يؤسفنا رحيلك. أنت مرحَّب بك للعودة في أي وقت.`,
  },
};

export function accountDeletedEmail(args: { dateStr: string; locale?: EmailLocale }): EmailContent {
  const c = pickLocale(COPY, args.locale);
  return buildEmail({
    subject: c.subject,
    heading: c.heading,
    bodyHtml: c.body(escapeHtml(args.dateStr)),
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
