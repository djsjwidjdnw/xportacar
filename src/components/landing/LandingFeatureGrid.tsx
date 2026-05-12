"use client";

import { useTranslations } from "@/i18n/provider";
import { Icon, type IconName } from "@/components/shared/Icon";

interface Feature {
  iconName: IconName;
  titleKey: string;
  bodyKey: string;
}

export function LandingFeatureGrid({ features }: { features: Feature[] }) {
  const t = useTranslations("landing");
  return (
    <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => (
        <div
          key={f.titleKey}
          className="group rounded-2xl border border-grey-200 bg-white p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 transition-colors group-hover:bg-brand-100">
            <Icon name={f.iconName} className="size-5" />
          </span>
          <h3 className="mt-5 text-base font-bold text-grey-900">{t(f.titleKey)}</h3>
          <p className="mt-2 text-sm leading-relaxed text-grey-600">{t(f.bodyKey)}</p>
        </div>
      ))}
    </div>
  );
}
