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
  const clampPct = (v: number) => Math.min(98, Math.max(2, v));
  const avgPct = clampPct(((avgEur - minEur) / span) * 100);
  const pos = pricePosition(priceEur, valuation);
  const pricePct = priceEur != null ? clampPct(((priceEur - minEur) / span) * 100) : null;
  const posColor =
    pos === "fair" ? "bg-success-600" : pos === "below" ? "bg-warning-500" : pos === "above" ? "bg-error-600" : "bg-grey-400";
  const posText =
    pos === "fair" ? "text-success-700" : pos === "below" ? "text-warning-700" : pos === "above" ? "text-error-700" : "text-grey-500";

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

      {/* Track */}
      <div className="relative mt-5 mb-7 h-2 rounded-full bg-gradient-to-r from-warning-200 via-success-200 to-error-200">
        {/* avg tick */}
        <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-grey-500 ring-2 ring-white" style={{ left: `${avgPct}%` }} />
        {/* current price marker */}
        {pricePct != null && (
          <div className="absolute -top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pricePct}%` }}>
            <div className={cn("size-4 rounded-full ring-2 ring-white shadow", posColor)} />
            <span className={cn("mt-1 whitespace-nowrap text-[10px] font-bold", posText)}>{priceLabel} {format(priceEur)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold text-grey-600">
        <span>Min {format(minEur)}</span>
        <span>Max {format(maxEur)}</span>
      </div>

      <p className="mt-3 text-[11px] text-grey-500">{valuationLabel(valuation)}</p>
    </div>
  );
}
