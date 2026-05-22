"use client";

import { useTranslations } from "@/i18n/provider";
import { AnimatedCounter } from "./AnimatedCounter";

export function LandingHeroStats({
  vehicles, buyers, countries, cycles, liveAuctions,
}: {
  vehicles: number;
  buyers: number;
  countries: number;
  cycles: number;
  liveAuctions: number;
}) {
  const t = useTranslations("landing");

  // Every value is a real DB count — no padding, no Math.max floors.
  const stats: { value: number; labelKey: string; sub?: string }[] = [
    { value: vehicles,  labelKey: "statVehicles",  sub: liveAuctions ? `${liveAuctions} live now` : undefined },
    { value: buyers,    labelKey: "statBuyers" },
    { value: countries, labelKey: "statCountries" },
    { value: cycles,    labelKey: "statCycles" },
  ];

  return (
    <dl className="grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.labelKey}
          className="border-l-2 border-brand-200 pl-3 transition-colors hover:border-brand-500"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-grey-500">
            {t(s.labelKey)}
          </dt>
          <dd className="mt-1 text-3xl font-extrabold tabular-nums text-grey-900 sm:text-4xl">
            <AnimatedCounter value={s.value} />
          </dd>
          {s.sub && (
            <dd className="mt-0.5 text-[11px] font-semibold text-error-600">
              <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-error-600 align-middle" />
              {s.sub}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
