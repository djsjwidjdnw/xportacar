"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Icon, type IconName } from "@/components/shared/Icon";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, delta, iconName, accent = "brand",
}: {
  label: string;
  value: string;
  delta?: { value: string; positive: boolean };
  iconName: IconName;
  accent?: "brand" | "success" | "warning" | "error";
}) {
  const accents = {
    brand:   "bg-brand-50 text-brand-700",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    error:   "bg-error-50 text-error-700",
  } as const;

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-grey-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-grey-900">
            {value}
          </p>
        </div>
        <span className={cn("grid size-11 place-items-center rounded-xl", accents[accent])}>
          <Icon name={iconName} className="size-5" />
        </span>
      </div>
      {delta && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
            delta.positive
              ? "bg-success-50 text-success-700"
              : "bg-error-50 text-error-700",
          )}>
            {delta.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta.value}
          </span>
          <span className="text-grey-500">vs last 30 days</span>
        </div>
      )}
    </div>
  );
}
