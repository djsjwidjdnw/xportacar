"use client";

import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export interface PaintThicknessReading {
  panel: string;
  reading_microns: number;
  photo_url?: string | null;
  notes?: string | null;
}

// Canonical English panel key → i18n label key in the "paint" namespace.
const PANEL_LABEL_KEY: Record<string, string> = {
  front_bumper: "panelFrontBumper",
  hood: "panelHood",
  front_left_fender: "panelFrontLeftFender",
  front_right_fender: "panelFrontRightFender",
  front_left_door: "panelFrontLeftDoor",
  front_right_door: "panelFrontRightDoor",
  rear_left_door: "panelRearLeftDoor",
  rear_right_door: "panelRearRightDoor",
  trunk: "panelTrunk",
  roof: "panelRoof",
};

// Reading bands → colour token + status-label key. Thresholds are the agreed
// repaint-detection bands (shared verbatim with the mobile buyer app):
//   < 150 µm   → factory  (green)   factory paint, no repair
//  150–250 µm  → touch-up (amber)   minor touch-up possible
//   > 250 µm   → repaint  (red)     likely repainted or filler
type Band = {
  statusKey: "bandFactory" | "bandTouchup" | "bandRepaint";
  pill: string;
  value: string;
  dot: string;
  range: string;
};
const BANDS: Band[] = [
  { statusKey: "bandFactory", pill: "bg-success-50 text-success-700 ring-success-200", value: "text-success-700", dot: "bg-success-500", range: "<150µm" },
  { statusKey: "bandTouchup", pill: "bg-warning-50 text-warning-700 ring-warning-200", value: "text-warning-700", dot: "bg-warning-500", range: "150–250µm" },
  { statusKey: "bandRepaint", pill: "bg-error-50 text-error-700 ring-error-200", value: "text-error-700", dot: "bg-error-500", range: ">250µm" },
];
function band(microns: number): Band {
  if (!Number.isFinite(microns)) return BANDS[0];
  if (microns < 150) return BANDS[0];
  if (microns <= 250) return BANDS[1];
  return BANDS[2];
}

export function PaintThicknessReport({
  readings,
}: {
  readings: PaintThicknessReading[];
}) {
  const t = useTranslations("paint");
  // Drop rows without a real gauge reading. A null reading_microns coerces to 0
  // upstream (Number(null) === 0), which is finite and < 150 — so an unmeasured
  // panel would otherwise render as a green "0 µm · factory paint" badge.
  const valid = (readings ?? []).filter((r) => Number.isFinite(r.reading_microns) && r.reading_microns > 0);
  if (valid.length === 0) return null;

  return (
    <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
      <h2 className="text-lg font-bold text-grey-900">{t("title")}</h2>
      <p className="mt-1 text-sm text-grey-500">{t("subtitle")}</p>

      {/* Colour legend */}
      <div className="mt-3 mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
        {BANDS.map((b) => (
          <span key={b.statusKey} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-grey-600">
            <span className={cn("size-2 rounded-full", b.dot)} />
            {t(b.statusKey)}
            <span className="text-grey-400">{b.range}</span>
          </span>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {valid.map((r, i) => {
          const b = band(r.reading_microns);
          const labelKey = PANEL_LABEL_KEY[r.panel];
          const panelLabel = labelKey ? t(labelKey) : r.panel;
          return (
            <li
              key={`${r.panel}-${i}`}
              className="flex gap-3 rounded-xl border border-grey-200 bg-white p-3"
            >
              {r.photo_url ? (
                <a
                  href={r.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.photo_url}
                    alt={`${panelLabel} — ${r.reading_microns} ${t("micronsShort")}`}
                    loading="lazy"
                    className="size-16 rounded-lg object-cover ring-1 ring-grey-200 transition-opacity hover:opacity-90"
                  />
                </a>
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-grey-50 text-[10px] font-semibold text-grey-400 ring-1 ring-grey-200">
                  {t("micronsShort")}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium text-grey-900">{panelLabel}</p>
                  <p className={cn("shrink-0 text-sm font-bold tabular-nums", b.value)}>
                    {r.reading_microns}
                    <span className="ml-0.5 text-xs font-medium text-grey-400">
                      {t("micronsShort")}
                    </span>
                  </p>
                </div>

                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                    b.pill,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", b.dot)} />
                  {t(b.statusKey)}
                </span>

                {r.notes && (
                  <p className="mt-1.5 text-xs leading-relaxed text-grey-600">
                    <span className="font-semibold text-grey-500">{t("notes")}: </span>
                    {r.notes}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
