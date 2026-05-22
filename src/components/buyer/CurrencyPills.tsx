"use client";

import { cn } from "@/lib/utils";
import { CURRENCIES, useCurrency } from "@/lib/currency";

export function CurrencyPills({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div className={cn(
      "inline-flex items-center gap-1 rounded-full bg-grey-100 p-1",
      className,
    )}>
      {CURRENCIES.map((c) => {
        const active = c === currency;
        return (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-bold uppercase tracking-wide transition-colors",
              active
                ? "bg-white text-brand-700 shadow-sm ring-1 ring-grey-200"
                : "text-grey-500 hover:text-grey-700",
            )}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
