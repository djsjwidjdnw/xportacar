"use client";

// Currency conversion + display formatting.  Rates are intentionally
// hard-coded for now — wire a live FX feed in later without touching the
// pages that consume this hook.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Currency = "EUR" | "USD" | "AED" | "GBP";
export const CURRENCIES: Currency[] = ["EUR", "USD", "AED", "GBP"];

// Reference rates relative to 1 EUR.
const RATE_FROM_EUR: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  AED: 3.97,
  GBP: 0.86,
};

interface CurrencyValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  format: (amountEur: number | null | undefined) => string;
  convert: (amountEur: number) => number;
}

const CurrencyContext = createContext<CurrencyValue | null>(null);

function formatAmount(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-GB")}`;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>("EUR");

  const convert = useCallback(
    (amt: number) => amt * RATE_FROM_EUR[currency],
    [currency],
  );
  const format = useCallback(
    (amt: number | null | undefined) => {
      if (amt == null) return "—";
      return formatAmount(amt * RATE_FROM_EUR[currency], currency);
    },
    [currency],
  );

  const value = useMemo<CurrencyValue>(() => ({
    currency, setCurrency, convert, format,
  }), [currency, convert, format]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Fall back to a no-op EUR formatter for SSR / when the provider
    // isn't mounted — callers can render server-side without crashing.
    return {
      currency: "EUR" as Currency,
      setCurrency: () => {},
      convert: (amt: number) => amt,
      format: (amt: number | null | undefined) => (amt == null ? "—" : formatAmount(amt, "EUR")),
    } satisfies CurrencyValue;
  }
  return ctx;
}
