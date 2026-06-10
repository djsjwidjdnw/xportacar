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
    subject: "Welcome to XportACar",
    heading: (name) => `Welcome, ${name}`,
    headingNoName: "Welcome to XportACar",
    bodyHtml: `Your trade account is live. Browse our inventory of UAE-sourced vehicles bound for Europe and start bidding in live auctions.<br/><br/>
        If you plan to bid, complete your KYC verification from your profile so you're cleared to win and pay.`,
    ctaLabel: "Browse marketplace",
  },
  de: {
    subject: "Willkommen bei XportACar",
    heading: (name) => `Willkommen, ${name}`,
    headingNoName: "Willkommen bei XportACar",
    bodyHtml: `Ihr Händlerkonto ist aktiv. Durchstöbern Sie unser Angebot an Fahrzeugen aus den VAE für den europäischen Markt und bieten Sie in Live-Auktionen mit.<br/><br/>
        Wenn Sie bieten möchten, schließen Sie Ihre KYC-Verifizierung in Ihrem Profil ab, damit Sie zum Gewinnen und Bezahlen freigeschaltet sind.`,
    ctaLabel: "Marktplatz ansehen",
  },
  fr: {
    subject: "Bienvenue sur XportACar",
    heading: (name) => `Bienvenue, ${name}`,
    headingNoName: "Bienvenue sur XportACar",
    bodyHtml: `Votre compte professionnel est actif. Parcourez notre inventaire de véhicules en provenance des Émirats arabes unis à destination de l'Europe et commencez à enchérir dans les ventes en direct.<br/><br/>
        Si vous comptez enchérir, complétez votre vérification KYC depuis votre profil afin d'être autorisé à remporter et à payer.`,
    ctaLabel: "Parcourir le marché",
  },
  ar: {
    subject: "مرحبًا بك في XportACar",
    heading: (name) => `مرحبًا، ${name}`,
    headingNoName: "مرحبًا بك في XportACar",
    bodyHtml: `حسابك التجاري أصبح نشطًا. تصفّح مجموعتنا من المركبات القادمة من الإمارات والمتجهة إلى أوروبا وابدأ المزايدة في المزادات المباشرة.<br/><br/>
        إذا كنت تنوي المزايدة، أكمل التحقق من هويتك (KYC) من ملفك الشخصي حتى تتمكن من الفوز والدفع.`,
    ctaLabel: "تصفّح السوق",
  },
};

export function welcomeEmail(args: { name: string; locale?: EmailLocale }): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  const dir = args.locale === "ar" ? "rtl" : "ltr";
  return buildEmail({
    subject: c.subject,
    heading: name ? c.heading(name) : c.headingNoName,
    bodyHtml: c.bodyHtml,
    ctaUrl: `${SITE_URL}/marketplace`,
    ctaLabel: c.ctaLabel,
    dir,
  });
}
