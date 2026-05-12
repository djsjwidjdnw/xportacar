"use client";

import { useTranslations, useLocale } from "@/i18n/provider";
import { formatKm } from "@/lib/utils";
import type { Vehicle } from "@/types";

const localeMap: Record<string, string> = {
  en: "en-GB", de: "de-DE", ar: "ar-AE", fr: "fr-FR",
};

export function SpecsGrid({ vehicle }: { vehicle: Vehicle }) {
  const t = useTranslations("vehicle");
  const locale = useLocale();
  const intl = localeMap[locale] ?? "en-GB";

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("vin"),               value: <span className="font-mono text-xs">{vehicle.vin}</span> },
    { label: t("make"),              value: vehicle.make },
    { label: t("model"),             value: vehicle.model },
    { label: t("year"),              value: vehicle.year },
    { label: t("mileage"),           value: formatKm(vehicle.mileage_km, intl) },
    { label: t("fuel"),              value: <span className="capitalize">{vehicle.fuel_type}</span> },
    { label: t("transmission"),      value: <span className="capitalize">{vehicle.transmission}</span> },
    { label: t("drivetrain"),        value: vehicle.drivetrain ?? "—" },
    { label: t("engine"),            value: vehicle.engine ?? "—" },
    { label: t("exteriorColor"),     value: vehicle.exterior_color ?? "—" },
    { label: t("interiorColor"),     value: vehicle.interior_color ?? "—" },
    { label: t("bodyType"),          value: vehicle.body_type ?? "—" },
    { label: t("firstRegistration"), value: vehicle.first_registration
        ? new Intl.DateTimeFormat(intl, { dateStyle: "long" }).format(new Date(vehicle.first_registration))
        : "—" },
    { label: t("location"),          value: `${vehicle.location_city}, ${vehicle.location_country}` },
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 border-b border-grey-100 py-2.5 text-sm">
          <dt className="text-grey-500">{r.label}</dt>
          <dd className="text-right font-medium text-grey-900">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
