"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export function LandingCta() {
  const t = useTranslations("landing");
  return (
    <section className="border-t border-grey-200 bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-grey-900 px-8 py-14 sm:px-14 sm:py-20">
          <div className="absolute inset-0 -z-10 bg-grid-faint opacity-[0.07]" />
          <div className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-brand-600/40 blur-3xl" />
          <div className="absolute -left-10 bottom-0 -z-10 h-60 w-60 rounded-full bg-brand-500/30 blur-3xl" />
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t("ctaTitle")}
            </h2>
            <p className="mt-4 text-lg text-grey-300">{t("ctaBody")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className={cn(buttonVariants({ variant: "default", size: "lg" }), "h-12 bg-white px-6 text-base text-grey-900 hover:bg-grey-100")}
              >
                {t("ctaButton")}
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/marketplace"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 border-grey-700 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white")}
              >
                {t("heroCta")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
