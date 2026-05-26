"use client";

// Currency-aware market-value bar: min ── avg ── max with the listed price
// plotted on it (green in range, yellow below min, red above max).

import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { pricePosition, valuationLabel, type Valuation } from "@/lib/valuation";

export function MarketValueBar({
  valuation,
  priceEur,
  title = "Market value",
  priceLabel = "Listed",
}: {
  valuation: Valuation;
  priceEur?: number | null;
  title?: string;
  priceLabel?: string;
}) {
  const { format } = useCurrency();
  const { minEur, avgEur, maxEur } = valuation;
  const span = Math.max(1, maxEur - minEur);
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const avgPct = clamp(((avgEur - minEur) / span) * 100);
  const pos = pricePosition(priceEur, valuation);
  // Cap the marker at the bar edges: price > max sticks to the right edge,
  // price < min sticks to the left edge.
  const pricePct = priceEur != null ? clamp(((priceEur - minEur) / span) * 100) : null;
  const posColor =
    pos === "fair" ? "bg-success-600" : pos === "below" ? "bg-warning-500" : pos === "above" ? "bg-error-600" : "bg-grey-400";
  const posText =
    pos === "fair" ? "text-success-700" : pos === "below" ? "text-warning-700" : pos === "above" ? "text-error-700" : "text-grey-500";

  // Keep the price label inside the card: anchor it left near the start,
  // right near the end, centered in the middle — never overflowing the edge.
  const labelStyle: React.CSSProperties =
    pricePct == null ? {}
    : pricePct <= 12 ? { left: 0 }
    : pricePct >= 88 ? { right: 0 }
    : { left: `${pricePct}%`, transform: "translateX(-50%)" };
  const labelAlign =
    pricePct == null ? "" : pricePct <= 12 ? "text-left" : pricePct >= 88 ? "text-right" : "text-center";

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-grey-900">{title}</h3>
        {priceEur != null && pos !== "unknown" && (
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1",
            pos === "fair" ? "bg-success-50 ring-success-100" : pos === "below" ? "bg-warning-50 ring-warning-100" : "bg-error-50 ring-error-100",
            posText,
          )}>
            {pos === "fair" ? "Fair" : pos === "below" ? "Below market" : "Above market"}
          </span>
        )}
      </div>

      <p className="mt-3 text-2xl font-extrabold tabular-nums text-grey-900">{format(avgEur)}</p>
      <p className="text-[11px] text-grey-500">average market value</p>

      {/* Gradient track: green (min) → yellow (avg) → red (max) */}
      <div className="relative mt-6 h-3 rounded-full bg-gradient-to-r from-success-500 via-warning-500 to-error-500">
        {/* min / max edge ticks */}
        <div className="absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-white/70" />
        <div className="absolute top-1/2 right-0 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-white/70" />
        {/* avg tick */}
        <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-grey-700 ring-2 ring-white" style={{ left: `${avgPct}%` }} />
        {/* current price marker — capped within [0,100] */}
        {pricePct != null && (
          <div
            className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow", posColor)}
            style={{ left: `${pricePct}%` }}
          />
        )}
      </div>

      {/* Price label row — positioned so it never overflows the container */}
      {pricePct != null && (
        <div className="relative mt-1.5 h-4">
          <span className={cn("absolute max-w-full truncate text-[11px] font-bold", posText, labelAlign)} style={labelStyle}>
            {priceLabel} {format(priceEur)}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-grey-600">
        <span>Min {format(minEur)}</span>
        <span>Max {format(maxEur)}</span>
      </div>

      <p className="mt-3 text-[11px] text-grey-500">{valuationLabel(valuation)}</p>
    </div>
  );
}
