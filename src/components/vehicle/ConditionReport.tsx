"use client";

import { ShieldCheck, AlertCircle, Images, ChevronRight, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { VehicleDamage } from "@/types";

const SEVERITY_STYLES: Record<VehicleDamage["severity"], { className: string; key: string }> = {
  cosmetic: { className: "bg-grey-100 text-grey-700 ring-grey-200",          key: "severityCosmetic" },
  minor:    { className: "bg-warning-50 text-warning-700 ring-warning-200",  key: "severityMinor" },
  moderate: { className: "bg-warning-50 text-warning-700 ring-warning-200",  key: "severityModerate" },
  major:    { className: "bg-error-50 text-error-700 ring-error-200",        key: "severityMajor" },
};

interface ReportPhoto { url: string; caption?: string | null }

export function ConditionReport({
  damages,
  photos,
  inspectionNotes,
  inspectionDate,
}: {
  damages: VehicleDamage[];
  photos?: ReportPhoto[];
  inspectionNotes?: string | null;
  inspectionDate?: string | null;
}) {
  const t = useTranslations("vehicle");

  // The full report is worth opening when there are photos, inspector notes,
  // or damage photos the buyer can drill into.
  const hasFullReport =
    (photos?.length ?? 0) > 0 || !!inspectionNotes || damages.some((d) => d.photo_url);

  const summary =
    damages.length === 0 ? (
      <div className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-600" />
        <p className="text-sm text-success-700">{t("noDamages")}</p>
      </div>
    ) : (
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

  if (!hasFullReport) return summary;

  return (
    <div className="space-y-3">
      {summary}
      <Dialog>
        <DialogTrigger render={
          <Button variant="outline" className="h-11 w-full justify-between">
            <span className="flex items-center gap-2">
              <Images className="size-4 text-brand-600" />
              {t("viewFullReport")}
            </span>
            <ChevronRight className="size-4 text-grey-400" />
          </Button>
        } />
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("inspectionReport")}</DialogTitle>
          </DialogHeader>

          {/* Meta */}
          {inspectionDate && (
            <div className="flex items-center gap-2 rounded-lg bg-grey-50 px-4 py-2.5 text-sm">
              <Calendar className="size-4 text-brand-600" />
              <span className="font-medium text-grey-700">{t("inspectedOn")}</span>
              <span className="text-grey-900">
                {new Date(inspectionDate).toLocaleDateString("en-GB", {
                  weekday: "short", day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
          )}

          {/* Inspector notes */}
          {inspectionNotes && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-grey-900">{t("inspectorNotes")}</h3>
              <p className="rounded-lg bg-grey-50 p-4 text-sm leading-relaxed text-grey-700">{inspectionNotes}</p>
            </section>
          )}

          {/* Photos */}
          {photos && photos.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-grey-900">
                {t("photos")} ({photos.length})
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={p.url}
                    alt={p.caption ?? `Inspection photo ${i + 1}`}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-lg object-cover ring-1 ring-grey-200"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Damage detail with photos */}
          <section>
            <h3 className="mb-2 text-sm font-bold text-grey-900">
              {t("conditionReport")} ({damages.length})
            </h3>
            {damages.length === 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50 p-4">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-600" />
                <p className="text-sm text-success-700">{t("noDamages")}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {damages.map((d) => {
                  const sty = SEVERITY_STYLES[d.severity];
                  return (
                    <li key={d.id} className="flex gap-3 rounded-xl border border-grey-200 bg-white p-3">
                      {d.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={d.photo_url}
                          alt={d.location}
                          loading="lazy"
                          className="size-20 shrink-0 rounded-lg object-cover ring-1 ring-grey-200"
                        />
                      ) : (
                        <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-grey-50 text-grey-400 ring-1 ring-grey-200">
                          <AlertCircle className="size-5" />
                        </div>
                      )}
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
            )}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
}
