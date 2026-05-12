"use client";

import { useTranslations } from "@/i18n/provider";
import { Icon, type IconName } from "@/components/shared/Icon";

interface Step {
  iconName: IconName;
  titleKey: string;
  bodyKey: string;
}

export function LandingHowItWorks({ steps }: { steps: Step[] }) {
  const t = useTranslations("landing");
  return (
    <ol className="mt-14 grid gap-6 md:grid-cols-3">
      {steps.map((s, i) => (
        <li
          key={s.titleKey}
          className="relative rounded-2xl bg-white p-7 shadow-sm ring-1 ring-grey-200"
        >
          <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white shadow">
            0{i + 1}
          </span>
          <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Icon name={s.iconName} className="size-5" />
          </span>
          <h3 className="mt-5 text-lg font-bold text-grey-900">{t(s.titleKey)}</h3>
          <p className="mt-2 text-sm leading-relaxed text-grey-600">{t(s.bodyKey)}</p>
        </li>
      ))}
    </ol>
  );
}
