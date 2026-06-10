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
  subject: (applicantName: string) => string;
  heading: string;
  intro: string;
  labels: {
    name: string;
    email: string;
    country: string;
    city: string;
    experience: string;
  };
  notProvided: string;
  ctaLabel: string;
};

const COPY: Localized<Copy> = {
  en: {
    subject: (applicantName) => `New inspector application — ${applicantName}`,
    heading: "New inspector signed up",
    intro: "A new inspector has signed up and is awaiting review:",
    labels: {
      name: "Name",
      email: "Email",
      country: "Country",
      city: "City",
      experience: "Experience",
    },
    notProvided: "Not provided",
    ctaLabel: "Review inspectors",
  },
  de: {
    subject: (applicantName) => `Neue Prüfer-Bewerbung — ${applicantName}`,
    heading: "Neuer Prüfer hat sich registriert",
    intro: "Ein neuer Prüfer hat sich registriert und wartet auf Überprüfung:",
    labels: {
      name: "Name",
      email: "E-Mail",
      country: "Land",
      city: "Stadt",
      experience: "Erfahrung",
    },
    notProvided: "Nicht angegeben",
    ctaLabel: "Prüfer überprüfen",
  },
  fr: {
    subject: (applicantName) => `Nouvelle candidature d'inspecteur — ${applicantName}`,
    heading: "Nouvel inspecteur inscrit",
    intro: "Un nouvel inspecteur s'est inscrit et attend une vérification :",
    labels: {
      name: "Nom",
      email: "E-mail",
      country: "Pays",
      city: "Ville",
      experience: "Expérience",
    },
    notProvided: "Non renseigné",
    ctaLabel: "Examiner les inspecteurs",
  },
  ar: {
    subject: (applicantName) => `طلب فاحص جديد — ${applicantName}`,
    heading: "سجّل فاحص جديد",
    intro: "سجّل فاحص جديد وهو في انتظار المراجعة:",
    labels: {
      name: "الاسم",
      email: "البريد الإلكتروني",
      country: "الدولة",
      city: "المدينة",
      experience: "الخبرة",
    },
    notProvided: "غير مُقدَّم",
    ctaLabel: "مراجعة الفاحصين",
  },
};

/** Admin alert: a new inspector self-registered and needs review. */
export function newInspectorApplicationEmail(args: {
  applicantName: string;
  applicantEmail: string;
  country?: string;
  city?: string;
  experience?: string;
  locale?: EmailLocale;
}): EmailContent {
  const c = pickLocale(COPY, args.locale);
  const name = escapeHtml(args.applicantName?.trim() || c.notProvided);
  const email = escapeHtml(args.applicantEmail?.trim() || c.notProvided);
  const country = escapeHtml(args.country?.trim() || c.notProvided);
  const city = escapeHtml(args.city?.trim() || c.notProvided);
  const experience = escapeHtml(args.experience?.trim() || c.notProvided);

  const rows = [
    `<strong>${c.labels.name}:</strong> ${name}`,
    `<strong>${c.labels.email}:</strong> ${email}`,
    `<strong>${c.labels.country}:</strong> ${country}`,
    `<strong>${c.labels.city}:</strong> ${city}`,
    `<strong>${c.labels.experience}:</strong> ${experience}`,
  ].join("<br/>");

  return buildEmail({
    subject: c.subject(args.applicantName?.trim() || args.applicantEmail),
    heading: c.heading,
    bodyHtml: `${c.intro}<br/><br/>${rows}`,
    ctaUrl: `${SITE_URL}/admin/inspectors`,
    ctaLabel: c.ctaLabel,
    dir: args.locale === "ar" ? "rtl" : "ltr",
  });
}
