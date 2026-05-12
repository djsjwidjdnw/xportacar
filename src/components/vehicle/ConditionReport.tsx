"use client";

import { ShieldCheck, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { VehicleDamage } from "@/types";

const SEVERITY_STYLES: Record<VehicleDamage["severity"], { className: string; key: string }> = {
  cosmetic: { className: "bg-grey-100 text-grey-700 ring-grey-200",          key: "severityCosmetic" },
  minor:    { className: "bg-warning-50 text-warning-700 ring-warning-200",  key: "severityMinor" },
  moderate: { className: "bg-warning-50 text-warning-700 ring-warning-200",  key: "severityModerate" },
  major:    { className: "bg-error-50 text-error-700 ring-error-200",        key: "severityMajor" },
};

export function ConditionReport({ damages }: { damages: VehicleDamage[] }) {
  const t = useTranslations("vehicle");

  if (damages.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-600" />
        <p className="text-sm text-success-700">{t("noDamages")}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-grey-100 rounded-xl border border-grey-200 bg-white">
      {damages.map((d) => {
        const sty = SEVERITY_STYLES[d.severity];
        return (
          <li key={d.id} className="flex items-start gap-4 px-4 py-3.5">
            <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-grey-50 text-grey-500">
              <AlertCircle className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-grey-900">{d.location}</p>
                <Badge className={cn("ring-1", sty.className)}>{t(sty.key)}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-grey-600">{d.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
