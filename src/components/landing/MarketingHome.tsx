import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingHeroStats } from "@/components/landing/LandingHeroStats";
import { LandingHeading } from "@/components/landing/LandingHeading";
import { LandingFeatureGrid } from "@/components/landing/LandingFeatureGrid";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingCta } from "@/components/landing/LandingCta";
import { TrustBadges } from "@/components/landing/TrustBadges";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getTranslations } from "@/i18n/server";

// The standard marketing homepage. Shown when the pre-launch landing toggle is
// off (app_settings.landing_mode_enabled = false). Extracted from the homepage
// route so the route can switch between this and <PrelaunchLanding />.
export async function MarketingHome() {
  const supabase = await createClient();
  const t = await getTranslations("landing");

  // Live numbers for the hero stats.  All four come straight from the DB —
  // see LandingHeroStats for how they're rendered.
  const [
    { count: vehicles },
    { count: buyers },
    { count: liveAuctions },
    { count: totalAuctions },
    { data: countryRows },
  ] = await Promise.all([
    supabase.from("vehicles").select("*", { count: "exact", head: true })
      .in("status", ["listed", "in_auction"]),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "buyer"),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("auctions").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("country").eq("role", "buyer").not("country", "is", null),
  ]);

  const countries = new Set(
    (countryRows ?? [])
      .map((r) => (r as { country: string | null }).country?.trim())
      .filter(Boolean) as string[],
  ).size;

  return (
    <>
      {/* ----------------------------- HERO ----------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
        {/* Faint grid + soft radial glow overlay — adds depth without
            distracting from the headline / photo mosaic. */}
        <div className="absolute inset-0 -z-10 bg-grid-faint [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        <div className="absolute -top-32 left-1/2 -z-10 size-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-300/30 via-brand-200/20 to-transparent blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:py-28">
          <div className="lg:col-span-7">
            <Badge variant="outline" className="mb-5 border-brand-200 bg-brand-50 text-brand-700">
              {t("heroEyebrow")}
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-grey-900 sm:text-5xl lg:text-6xl">
              <LandingHeading />
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-grey-600">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/marketplace"
                className={cn(
                  buttonVariants({ variant: "default", size: "lg" }),
                  "group h-14 px-7 text-base font-bold shadow-lg shadow-brand-500/25 transition-all hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-0.5",
                )}
              >
                {t("heroCta")}
                <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#how"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-14 px-7 text-base font-semibold transition-colors hover:bg-grey-50",
                )}
              >
                {t("heroCtaSecondary")}
              </Link>
            </div>
            <div className="mt-10">
              <LandingHeroStats
                vehicles={vehicles ?? 0}
                buyers={buyers ?? 0}
                countries={countries}
                cycles={totalAuctions ?? 0}
                liveAuctions={liveAuctions ?? 0}
              />
            </div>
          </div>

          {/* Hero card mosaic */}
          <div className="relative lg:col-span-5">
            <div className="absolute -top-6 left-6 right-6 h-72 rounded-3xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 blur-3xl" />
            <div className="relative grid grid-cols-2 gap-3">
              <HeroPhoto src="/rs6.avif" alt={t("heroPhotoAltPremium")} tall />
              <div className="grid gap-3">
                <HeroPhoto src="/inspection55.avif" alt={t("heroPhotoAltInspection")} />
                <HeroPhoto src="/transport55.avif" alt={t("heroPhotoAltTransport")} />
              </div>
              <div className="col-span-2 mt-1 flex items-center gap-3 rounded-2xl border border-grey-200 bg-white/90 p-4 shadow-lg backdrop-blur">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-success-50 text-success-600">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-grey-900">200-point inspection on every car</p>
                  <p className="text-xs text-grey-500">UAE field teams · OEM history check · damage map</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------- TRUST BADGES ------------------------- */}
      <TrustBadges />

      {/* --------------------------- FEATURES --------------------------- */}
      <section className="border-t border-grey-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              {t("featuresEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
              {t("featuresTitle")}
            </h2>
          </div>
          <LandingFeatureGrid
            features={[
              { iconName: "camera",      titleKey: "feature1Title", bodyKey: "feature1Body" },
              { iconName: "gavel",       titleKey: "feature2Title", bodyKey: "feature2Body" },
              { iconName: "user-check",  titleKey: "feature3Title", bodyKey: "feature3Body" },
              { iconName: "container",   titleKey: "feature4Title", bodyKey: "feature4Body" },
              { iconName: "badge-euro",  titleKey: "feature5Title", bodyKey: "feature5Body" },
              { iconName: "file-check",  titleKey: "feature6Title", bodyKey: "feature6Body" },
            ]}
          />
        </div>
      </section>

      {/* ------------------------ HOW IT WORKS ------------------------- */}
      <section id="how" className="border-t border-grey-200 bg-grey-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
              {t("howEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-grey-900 sm:text-4xl">
              {t("howTitle")}
            </h2>
          </div>
          <LandingHowItWorks
            steps={[
              { iconName: "search", titleKey: "howStep1Title", bodyKey: "howStep1Body" },
              { iconName: "gavel",  titleKey: "howStep2Title", bodyKey: "howStep2Body" },
              { iconName: "truck",  titleKey: "howStep3Title", bodyKey: "howStep3Body" },
            ]}
          />
        </div>
      </section>

      {/* ------------------------------ CTA ----------------------------- */}
      <LandingCta />
    </>
  );
}

function HeroPhoto({ src, alt, tall }: { src: string; alt: string; tall?: boolean }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={cn(
        "w-full rounded-2xl object-cover shadow-xl ring-1 ring-grey-900/5",
        tall ? "h-[28rem] row-span-2" : "h-[13.5rem]",
      )}
      loading="eager"
    />
  );
}
