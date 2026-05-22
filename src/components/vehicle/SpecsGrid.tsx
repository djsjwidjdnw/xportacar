"use client";

import {
  Barcode, BadgeCheck, Calendar, Car, Cog, Fuel, Gauge, MapPin, Palette,
  Sparkles, Wrench, Zap, type LucideIcon,
} from "lucide-react";

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

  const rows: { label: string; value: React.ReactNode; icon: LucideIcon }[] = [
    { label: t("vin"),               value: <span className="font-mono text-xs">{vehicle.vin}</span>, icon: Barcode },
    { label: t("make"),              value: vehicle.make,  icon: Car },
    { label: t("model"),             value: vehicle.model, icon: BadgeCheck },
    { label: t("year"),              value: vehicle.year,  icon: Calendar },
    { label: t("mileage"),           value: formatKm(vehicle.mileage_km, intl), icon: Gauge },
    { label: t("fuel"),              value: <span className="capitalize">{vehicle.fuel_type}</span>,     icon: Fuel },
    { label: t("transmission"),      value: <span className="capitalize">{vehicle.transmission}</span>, icon: Cog },
    { label: t("drivetrain"),        value: vehicle.drivetrain ?? "—", icon: Wrench },
    { label: t("engine"),            value: vehicle.engine ?? "—",      icon: Zap },
    { label: t("exteriorColor"),     value: vehicle.exterior_color ?? "—", icon: Palette },
    { label: t("interiorColor"),     value: vehicle.interior_color ?? "—", icon: Sparkles },
    { label: t("bodyType"),          value: vehicle.body_type ?? "—",      icon: Car },
    { label: t("firstRegistration"), value: vehicle.first_registration
        ? new Intl.DateTimeFormat(intl, { dateStyle: "long" }).format(new Date(vehicle.first_registration))
        : "—",
      icon: Calendar },
    { label: t("location"),          value: `${vehicle.location_city}, ${vehicle.location_country}`, icon: MapPin },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((r) => {
        const Icon = r.icon;
        return (
          <div
            key={r.label}
            className="flex items-center gap-3 rounded-xl border border-grey-200 bg-white p-3 transition-colors hover:border-grey-300"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-grey-500">{r.label}</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-grey-900">{r.value}</p>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
