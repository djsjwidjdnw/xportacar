import {
  buildEmail,
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
  bodyHtml: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: "Your XportACar account is verified",
    heading: (name) => `You're verified, ${name}`,
    headingNoName: "You're verified",
    bodyHtml: `Your KYC documents have been approved. Your account is now fully cleared to buy and pay for vehicles on XportACar.`,
    ctaLabel: "Browse marketplace",
  },
  de: {
    subject: "Ihr XportACar-Konto ist verifiziert",
    heading: (name) => `Sie sind verifiziert, ${name}`,
    headingNoName: "Sie sind verifiziert",
    bodyHtml: `Ihre KYC-Dokumente wurden genehmigt. Ihr Konto ist jetzt vollständig freigeschaltet, um Fahrzeuge auf XportACar zu kaufen und zu bezahlen.`,
    ctaLabel: "Marktplatz ansehen",
  },
  fr: {
    subject: "Votre compte XportACar est vérifié",
    heading: (name) => `Vous êtes vérifié, ${name}`,
    headingNoName: "Vous êtes vérifié",
    bodyHtml: `Vos documents KYC ont été approuvés. Votre compte est désormais entièrement autorisé à acheter et payer des véhicules sur XportACar.`,
    ctaLabel: "Parcourir le marché",
  },
  ar: {
    subject: "تم التحقق من حسابك في XportACar",
    heading: (name) => `تم التحقق منك، ${name}`,
    headingNoName: "تم التحقق منك",
    bodyHtml: `تمت الموافقة على مستندات التحقق من هويتك (KYC). أصبح حسابك الآن مؤهلًا بالكامل لشراء المركبات ودفع ثمنها على XportACar.`,
    ctaLabel: "تصفّح السوق",
  },
};

export function kycApprovedEmail(args: { name: string; locale?: EmailLocale }): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  return buildEmail({
    subject: c.subject,
    heading: name ? c.heading(name) : c.headingNoName,
    bodyHtml: c.bodyHtml,
    ctaUrl: `${SITE_URL}/marketplace`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
