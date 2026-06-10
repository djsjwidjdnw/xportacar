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
  reasonLabel: string;
  bodyHtml: (reasonBlock: string) => string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: "Action needed: your KYC submission",
    heading: (name) => `${name}, we couldn't verify your documents`,
    headingNoName: "We couldn't verify your documents",
    reasonLabel: "Reason",
    bodyHtml: (reasonBlock) =>
      `Your KYC submission was not approved this time.${reasonBlock}<br/><br/>Please re-upload corrected documents from your profile and we'll review them again.`,
    ctaLabel: "Re-submit documents",
  },
  de: {
    subject: "Handlungsbedarf: Ihre KYC-Einreichung",
    heading: (name) => `${name}, wir konnten Ihre Dokumente nicht verifizieren`,
    headingNoName: "Wir konnten Ihre Dokumente nicht verifizieren",
    reasonLabel: "Grund",
    bodyHtml: (reasonBlock) =>
      `Ihre KYC-Einreichung wurde diesmal nicht genehmigt.${reasonBlock}<br/><br/>Bitte laden Sie korrigierte Dokumente erneut über Ihr Profil hoch, und wir prüfen sie noch einmal.`,
    ctaLabel: "Dokumente erneut einreichen",
  },
  fr: {
    subject: "Action requise : votre soumission KYC",
    heading: (name) => `${name}, nous n'avons pas pu vérifier vos documents`,
    headingNoName: "Nous n'avons pas pu vérifier vos documents",
    reasonLabel: "Motif",
    bodyHtml: (reasonBlock) =>
      `Votre soumission KYC n'a pas été approuvée cette fois.${reasonBlock}<br/><br/>Veuillez téléverser à nouveau des documents corrigés depuis votre profil et nous les examinerons de nouveau.`,
    ctaLabel: "Soumettre à nouveau les documents",
  },
  ar: {
    subject: "إجراء مطلوب: طلب التحقق من هويتك",
    heading: (name) => `${name}، لم نتمكن من التحقق من مستنداتك`,
    headingNoName: "لم نتمكن من التحقق من مستنداتك",
    reasonLabel: "السبب",
    bodyHtml: (reasonBlock) =>
      `لم تتم الموافقة على طلب التحقق من هويتك هذه المرة.${reasonBlock}<br/><br/>يرجى إعادة رفع المستندات المصحّحة من ملفك الشخصي وسنراجعها مرة أخرى.`,
    ctaLabel: "إعادة تقديم المستندات",
  },
};

export function kycRejectedEmail(args: {
  name: string;
  reason: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = args.name?.trim();
  const reason = args.reason?.trim();
  const reasonBlock = reason
    ? `<br/><br/><strong>${c.reasonLabel}:</strong> ${escapeHtml(reason)}`
    : "";
  return buildEmail({
    subject: c.subject,
    heading: name ? c.heading(name) : c.headingNoName,
    bodyHtml: c.bodyHtml(reasonBlock),
    ctaUrl: `${SITE_URL}/profile`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
