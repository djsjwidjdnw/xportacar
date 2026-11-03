import Link from "next/link";
import { Building2, Mail, MapPin } from "lucide-react";

import { getTranslations } from "@/i18n/server";

// Contact page: email + postal address only. There is no contact form in the
// codebase, so this is a mailto link. No phone number exists: none is shown.
const EMAIL = "contact@xportacar.com";
const ADDRESS = "Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai, U.A.E.";

export async function generateMetadata() {
  const t = await getTranslations("contact");
  return { title: `${t("metaTitle")} — XportACar` };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <div className="bg-white">
      <section className="border-b border-grey-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-grey-700">{t("intro")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={`mailto:${EMAIL}`}
            className="rounded-xl border border-grey-200 p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:col-span-2"
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-grey-500">
              <Mail className="size-4 text-brand-600" />
              {t("emailLabel")}
            </p>
            <p className="mt-1 text-lg font-semibold text-brand-700">{EMAIL}</p>
          </a>
          <div className="rounded-xl border border-grey-200 p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-grey-500">
              <MapPin className="size-4 text-brand-600" />
              {t("addressLabel")}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-grey-900">{ADDRESS}</p>
          </div>
          <div className="rounded-xl border border-grey-200 p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-grey-500">
              <Building2 className="size-4 text-brand-600" />
              {t("operatorLabel")}
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-grey-900">{t("operatorValue")}</p>
          </div>
        </div>

        <a
          href={`mailto:${EMAIL}`}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Mail className="size-4" />
          {t("emailCta")}
        </a>

        <p className="mt-14 flex flex-wrap gap-x-6 gap-y-2 border-t border-grey-100 pt-6 text-sm">
          <Link href="/help" className="font-medium text-brand-700 hover:underline">{t("helpLink")}</Link>
          <Link href="/imprint" className="font-medium text-brand-700 hover:underline">{t("imprintLink")}</Link>
        </p>
      </div>
    </div>
  );
}