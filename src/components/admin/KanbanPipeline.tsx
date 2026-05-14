"use client";

import Link from "next/link";
import { Calendar, ClipboardCheck, Gavel, CheckCircle2 } from "lucide-react";

import { VehicleStatusSelect } from "./VehicleStatusSelect";
import { InspectorAssignSelect } from "./InspectorAssignSelect";
import { useTranslations } from "@/i18n/provider";
import { cn, formatEur } from "@/lib/utils";
import type { Vehicle } from "@/types";

interface PipelineColumn {
  key: "scheduled" | "inspected" | "in_auction" | "sold";
  vehicles: Vehicle[];
}

interface Inspector { id: string; full_name: string | null; email: string | null }

const COL_META = {
  scheduled:  { icon: Calendar,        accent: "border-grey-300",   ring: "ring-grey-200",   labelKey: "pipelineScheduled" },
  inspected:  { icon: ClipboardCheck,  accent: "border-brand-400",  ring: "ring-brand-100",  labelKey: "pipelineInspected" },
  in_auction: { icon: Gavel,           accent: "border-warning-400",ring: "ring-warning-100", labelKey: "pipelineInAuction" },
  sold:       { icon: CheckCircle2,    accent: "border-success-500",ring: "ring-success-100", labelKey: "pipelineSold" },
} as const;

export function KanbanPipeline({
  columns,
  inspectors = [],
}: {
  columns: PipelineColumn[];
  inspectors?: Inspector[];
}) {
  const t = useTranslations("admin");
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((col) => {
        const meta = COL_META[col.key];
        const Icon = meta.icon;
        return (
          <div key={col.key} className={cn("rounded-2xl border-t-4 bg-grey-50 p-3 ring-1", meta.accent, meta.ring)}>
            <header className="flex items-center justify-between gap-2 px-1 pb-2">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-grey-600" />
                <h3 className="text-sm font-bold text-grey-900">{t(meta.labelKey)}</h3>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-grey-700 ring-1 ring-grey-200">
                {col.vehicles.length}
              </span>
            </header>
            <ul className="space-y-2">
              {col.vehicles.length === 0 ? (
                <li className="rounded-lg border border-dashed border-grey-200 bg-white px-3 py-6 text-center text-xs text-grey-400">
                  No vehicles
                </li>
              ) : col.vehicles.slice(0, 6).map((v) => (
                <li key={v.id} className="rounded-lg border border-grey-200 bg-white p-3 shadow-xs">
                  <Link
                    href={`/admin/vehicles/${v.id}`}
                    className="block transition-colors hover:text-brand-700"
                  >
                    <p className="truncate text-sm font-semibold text-grey-900 hover:text-brand-700">
                      {v.year} {v.make} {v.model}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-grey-500">
                      {v.location_city} · {v.exterior_color}
                    </p>
                    <p className="mt-1 text-xs font-medium text-brand-700">
                      {formatEur(v.listed_price_eur)}
                    </p>
                  </Link>
                  <div className="mt-2">
                    <VehicleStatusSelect vehicleId={v.id} currentStatus={v.status} compact />
                  </div>
                  {col.key === "scheduled" && inspectors.length > 0 && (
                    <div className="mt-1.5">
                      <InspectorAssignSelect
                        vehicleId={v.id}
                        currentInspectorId={v.inspector_id ?? null}
                        inspectors={inspectors}
                        compact
                      />
                    </div>
                  )}
                </li>
              ))}
              {col.vehicles.length > 6 && (
                <li className="px-1 pt-1">
                  <Link href={`/admin/vehicles?status=${col.key}`} className="text-xs font-medium text-brand-700 hover:underline">
                    View all {col.vehicles.length} →
                  </Link>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
