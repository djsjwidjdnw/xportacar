import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { MarketPricesRefreshButton } from "@/components/admin/MarketPricesRefreshButton";
import type { MarketPricesRecord } from "@/lib/market-prices";
import { formatEur } from "@/lib/utils";

// Admin vehicle page: what the market-prices lookup found for each side, the
// last error, and a manual Refresh. The buyer card itself is rendered on the
// same page from the same row.

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
const aed = (n: number | string | null) =>
  n == null ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(Number(n));

function SideRow({
  label, source, status, value, count, error, fetchedAt,
}: {
  label: string;
  source: string;
  status: string | null;
  value: string;
  count: number | null;
  error: string | null;
  fetchedAt: string | null;
}) {
  const Icon = status === "ok" ? CheckCircle2 : status ? AlertCircle : CircleDashed;
  const tone = status === "ok" ? "text-success-600" : status === "error" ? "text-error-600" : status ? "text-warning-600" : "text-grey-400";
  return (
    <div className="border-b border-grey-100 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-grey-900">{label}</p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
          <Icon className="size-3.5" />
          {status === "ok" ? value : status === "insufficient_data" ? "Not enough data" : status === "error" ? "Error" : "Not looked up"}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-grey-500">
        {source}
        {status === "ok" && count != null ? ` · ${count} listings` : ""}
        {status === "insufficient_data" && count != null ? ` · ${count} usable listings` : ""}
        {fetchedAt ? ` · ${when(fetchedAt)}` : ""}
      </p>
      {error && <p className="mt-1 font-mono text-[11px] text-error-700">Last error: {error}</p>}
    </div>
  );
}

export function AdminMarketPrices({
  vehicleId,
  prices,
  enabled,
}: {
  vehicleId: string;
  prices: MarketPricesRecord | null;
  enabled: boolean;
}) {
  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">Market prices</p>
        <Badge className={enabled ? "bg-success-50 text-success-700 ring-1 ring-success-100" : "bg-grey-100 text-grey-700 ring-1 ring-grey-200"}>
          {enabled ? "On" : "Off (dormant)"}
        </Badge>
      </div>
      <div className="mt-2">
        <SideRow
          label="UAE market price" source="Dubizzle Motors via Apify"
          status={prices?.uae_status ?? null}
          value={`${aed(prices?.uae_median_aed ?? null)}${prices?.uae_median_eur != null ? ` · ${formatEur(Number(prices.uae_median_eur))}` : ""}`}
          count={prices?.uae_count ?? null} error={prices?.uae_error ?? null} fetchedAt={prices?.uae_fetched_at ?? null}
        />
        <SideRow
          label="EU market price" source="Vincario, europe group"
          status={prices?.eu_status ?? null}
          value={prices?.eu_median_eur != null ? formatEur(Number(prices.eu_median_eur)) : "—"}
          count={prices?.eu_count ?? null} error={prices?.eu_error ?? null} fetchedAt={prices?.eu_fetched_at ?? null}
        />
      </div>
      <p className="mt-3 text-[11px] text-grey-500">
        Looked up once per listing when you publish or relist; a result under 7 days old is reused.
        {prices?.fx_rate != null && prices.fx_date ? ` AED→EUR ${Number(prices.fx_rate).toFixed(5)} (ECB ${prices.fx_date}).` : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <MarketPricesRefreshButton vehicleId={vehicleId} disabled={!enabled} />
        <Link href="/admin/integrations" className="text-xs font-medium text-brand-700 hover:underline">
          Integrations →
        </Link>
      </div>
      {!enabled && (
        <p className="mt-2 text-[11px] text-grey-500">Market prices are off. Add the keys and switch them on in Integrations.</p>
      )}
    </div>
  );
}
