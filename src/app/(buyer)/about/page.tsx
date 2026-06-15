import type { Metadata } from "next";
import Link from "next/link";
import {
  Search, ClipboardCheck, FileCheck2, Ship, Landmark,
  Camera, Gauge, LineChart, ShieldCheck, Truck, Globe2, Mail,
} from "lucide-react";

import { getTranslations } from "@/i18n/server";
import { LandingCta } from "@/components/landing/LandingCta";

export const metadata: Metadata = {
  title: "About — XportACar",
  description:
    "Two decades exporting and importing vehicles. XportACar sources, inspects, ships and registers cars from the UAE to buyers across the EU.",
};

export default async function AboutPage() {
  const t = await getTranslations("about");

  const services = [
    { icon: Search,         t: t("doSourcingTitle"),  b: t("doSourcingBody") },
    { icon: ClipboardCheck, t: t("doInspectTitle"),   b: t("doInspectBody") },
    { icon: FileCheck2,     t: t("doRegisterTitle"),  b: t("doRegisterBody") },
    { icon: Ship,           t: t("doShippingTitle"),  b: t("doShippingBody") },
    { icon: Landmark,       t: t("doCustomsTitle"),   b: t("doCustomsBody") },
  ];

  const process = [
    { icon: ClipboardCheck, t: t("proc1Title"), b: t("proc1Body") },
    { icon: Gauge,          t: t("proc2Title"), b: t("proc2Body") },
    { icon: Camera,         t: t("proc3Title"), b: t("proc3Body") },
    { icon: LineChart,      t: t("proc4Title"), b: t("proc4Body") },
  ];

  const why = [
    { icon: Globe2,     t: t("why1Title"), b: t("why1Body") },
    { icon: ShieldCheck, t: t("why2Title"), b: t("why2Body") },
    { icon: Truck,      t: t("why3Title"), b: t("why3Body") },
    { icon: FileCheck2, t: t("why4Title"), b: t("why4Body") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="border-b border-grey-100 bg-gradient-to-b from-brand-50 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t("heroEyebrow")}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-grey-900 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-grey-600">{t("subtitle")}</p>
        </div>
      </section>

      {/* Our story */}
      <section className="border-t border-grey-200 bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t("storyEyebrow")}</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">{t("storyTitle")}</h2>
          </div>
          <div className="space-y-5 text-base leading-relaxed text-grey-600">
            <p>{t("storyP1")}</p>
            <p>{t("storyP2")}</p>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="border-t border-grey-200 bg-grey-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t("doEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">{t("doTitle")}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.t} className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
                <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-grey-900">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-grey-600">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our process */}
      <section className="border-t border-grey-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t("procEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">{t("procTitle")}</h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-grey-600">{t("procIntro")}</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((p, i) => (
              <div key={p.t} className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <p.icon className="size-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wide text-grey-400">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-bold text-grey-900">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-grey-600">{p.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="border-t border-grey-200 bg-grey-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t("whyEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">{t("whyTitle")}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {why.map((w) => (
              <div key={w.t} className="flex gap-4 rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <w.icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-grey-900">{w.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-grey-600">{w.b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-grey-200 bg-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">{t("contactEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">{t("contactTitle")}</h2>
          <p className="mt-4 text-base leading-relaxed text-grey-600">{t("contactBody")}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:contact@xportacar.com"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              <Mail className="size-4" />
              contact@xportacar.com
            </a>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-grey-200 bg-white px-5 py-3 text-sm font-semibold text-grey-800 transition-colors hover:bg-grey-50"
            >
              {t("contactCta")}
            </Link>
          </div>
        </div>
      </section>

      <LandingCta />
    </>
  );
}
