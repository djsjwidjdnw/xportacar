import Link from "next/link";
import { Mail, Building2, MapPin, Phone, Clock, ChevronDown, LifeBuoy, FileText, ShieldCheck } from "lucide-react";

import { getTranslations } from "@/i18n/server";

export const metadata = { title: "Support — XportACar" };

export default async function SupportPage() {
  const t = await getTranslations("support");

  const faqs = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    q: t(`q${n}q`),
    a: t(`q${n}a`),
  }));

  const contact = [
    { icon: Mail, label: t("emailLabel"), value: t("email"), href: `mailto:${t("email")}` },
    { icon: Building2, label: t("companyLabel"), value: t("toBeCompleted"), pending: true },
    { icon: MapPin, label: t("addressLabel"), value: t("toBeCompleted"), pending: true },
    { icon: Phone, label: t("phoneLabel"), value: t("toBeCompleted"), pending: true },
    { icon: Clock, label: t("hoursLabel"), value: t("hoursValue") },
  ];

  return (
    <div className="bg-white">
      {/* Header */}
      <section className="border-b border-grey-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
            <LifeBuoy className="size-4" />
            {t("title")}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-grey-600">{t("subtitle")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Contact */}
        <section>
          <h2 className="text-xl font-bold text-grey-900">{t("contactTitle")}</h2>
          <p className="mt-1 text-grey-600">{t("contactIntro")}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {contact.map((c) => {
              const Icon = c.icon;
              const body = (
                <>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-grey-500">
                    <Icon className="size-4 text-brand-600" />
                    {c.label}
                  </dt>
                  <dd className={`mt-1 text-sm font-medium ${c.pending ? "italic text-grey-400" : "text-grey-900"}`}>
                    {c.value}
                  </dd>
                </>
              );
              return c.href ? (
                <a key={c.label} href={c.href} className="rounded-xl border border-grey-200 p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                  {body}
                </a>
              ) : (
                <div key={c.label} className="rounded-xl border border-grey-200 p-4">{body}</div>
              );
            })}
          </dl>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="text-xl font-bold text-grey-900">{t("faqTitle")}</h2>
          <div className="mt-6 divide-y divide-grey-100 rounded-2xl border border-grey-200">
            {faqs.map((f, i) => (
              <details key={i} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className="font-semibold text-grey-900">{f.q}</span>
                  <ChevronDown className="size-5 shrink-0 text-grey-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-grey-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-14 rounded-2xl border border-brand-100 bg-brand-50/60 p-8 text-center">
          <h2 className="text-xl font-bold text-grey-900">{t("ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-grey-600">{t("ctaBody")}</p>
          <a
            href={`mailto:${t("email")}`}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Mail className="size-4" />
            {t("ctaButton")}
          </a>
        </section>

        {/* Legal links — Privacy Policy and Terms of Service */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-grey-100 pt-6 text-sm">
          <Link href="/privacy" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-grey-600 hover:bg-grey-50 hover:text-brand-700">
            <ShieldCheck className="size-4" />
            Privacy Policy
          </Link>
          <Link href="/terms" className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-grey-600 hover:bg-grey-50 hover:text-brand-700">
            <FileText className="size-4" />
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
