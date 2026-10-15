import { Info, Scale } from "lucide-react";

import { getTranslations, resolveLocale } from "@/i18n/server";
import { marketPricesView, showSpecNote, type MarketPricesRow } from "@/lib/market-prices-view";
import { cn } from "@/lib/utils";

// "Market prices": what this car sells for in the UAE and in Europe, from real
// listings (looked up once per listing; see migration 034). Shows only the
// sides that have data and hides itself when neither does.

const INTL_LOCALE: Record<string, string> = { en: "en-GB", de: "de-DE", ar: "ar-AE", fr: "fr-FR" };

export async function MarketPricesCard({
  prices,
  askingPriceAed,
  marketSpec,
  className,
}: {
  prices: MarketPricesRow | null;
  askingPriceAed: number | null;
  marketSpec: string | null;
  className?: string;
}) {
  const view = marketPricesView(prices, askingPriceAed);
  if (!view) return null;

  const t = await getTranslations("marketPrices");
  const locale = INTL_LOCALE[await resolveLocale()] ?? "en-GB";
  const money = (n: number, currency: "AED" | "EUR", signed = false) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0, signDisplay: signed ? "exceptZero" : "auto" }).format(n);
  const percent = (p: number) =>
    new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(p);
  const updated = view.updatedAt
    ? new Date(view.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
    : null;

  const { uae, eu, difference } = view;
  const asking = uae?.kind === "asking";

  return (
    <section className={cn("rounded-2xl border border-grey-200 bg-white p-6 shadow-xs", className)}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
        <Scale className="size-5 text-brand-600" />
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-grey-500">{t("subtitle")}</p>

      <div className={cn("mt-5 grid gap-3", uae && eu && "sm:grid-cols-2")}>
        {uae && (
          <div className={cn(
            "rounded-xl p-4",
            asking ? "border border-dashed border-grey-300 bg-white" : "border border-grey-200 bg-grey-50",
          )}>
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">
              {asking ? t("askingLabel") : t("uaeLabel")}
            </p>
            <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-grey-900">{money(uae.aed, "AED")}</p>
            {uae.eur != null && (
              <p className="text-sm font-semibold tabular-nums text-grey-600">{t("approx", { amount: money(uae.eur, "EUR") })}</p>
            )}
            <p className="mt-2 text-xs text-grey-500">
              {uae.kind === "market" ? t("basedOnUae", { count: uae.count }) : t("askingNote")}
            </p>
          </div>
        )}
        {eu && (
          <div className="rounded-xl border border-grey-200 bg-grey-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">{t("euLabel")}</p>
            <p className="mt-1.5 text-2xl font-extrabold tabular-nums text-grey-900">{money(eu.eur, "EUR")}</p>
            <p className="mt-2 text-xs text-grey-500">{t("basedOnEu", { count: eu.count })}</p>
          </div>
        )}
      </div>

      {difference && (
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
          <span className="text-sm font-semibold text-brand-800">
            {difference.basis === "asking" ? t("differenceAsking") : t("differenceMarket")}
          </span>
          <span className="text-base font-extrabold tabular-nums text-brand-800">
            {money(difference.eur, "EUR", true)}{" "}
            <span className="text-sm font-semibold">({percent(difference.pct)})</span>
          </span>
        </div>
      )}

      {eu && showSpecNote(marketSpec) && (
        <p className="mt-4 flex items-start gap-2 text-xs text-grey-600">
          <Info className="mt-px size-3.5 shrink-0 text-grey-400" />
          {t("specNote")}
        </p>
      )}
      {updated && <p className="mt-2 text-xs text-grey-400">{t("updated", { date: updated })}</p>}
    </section>
  );
}
