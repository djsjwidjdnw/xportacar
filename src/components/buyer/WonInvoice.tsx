"use client";

// Invoice + payment instructions shown on /auction/[id]/won.
// Lives client-side so the currency selector and live countdown can
// re-render without round-tripping to the server.

import { useEffect, useMemo, useState } from "react";
import { Building2, Clock, Receipt, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import {
  ShippingOptions, describeShipping, getShippingPriceEur,
  type ShippingChoice,
} from "@/components/vehicle/ShippingOptions";
import { useCurrency } from "@/lib/currency";

const PLATFORM_FEE_PCT = 0.05;

function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

function formatDeadline(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatRemaining(deadline: Date, now: Date): string {
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "Payment overdue";
  const totalHours = Math.floor(ms / 3600_000);
  const days  = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0)  return `${days} day${days === 1 ? "" : "s"}, ${hours}h remaining`;
  const mins = Math.floor((ms % 3600_000) / 60_000);
  return `${hours}h ${mins}m remaining`;
}

export function WonInvoice({
  vehicle, hammerEur, userEmail,
}: {
  vehicle: { year: number; make: string; model: string; vin: string; city: string; country: string };
  hammerEur: number;
  userEmail: string | null;
}) {
  const { format } = useCurrency();
  const [shipping, setShipping] = useState<ShippingChoice>({ kind: "port", port: "Hamburg" });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(i);
  }, []);

  const deadline = useMemo(() => addWorkingDays(new Date(), 5), []);

  const feeEur = hammerEur * PLATFORM_FEE_PCT;
  const shippingEur = getShippingPriceEur(shipping);
  const totalEur = hammerEur + feeEur + shippingEur;

  const summary = `${vehicle.year} ${vehicle.make} ${vehicle.model} — Total due ${format(totalEur)} by ${formatDeadline(deadline)}`;

  const shareInvoice = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "XportACar invoice", text: summary }); }
      catch { /* user cancelled */ }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(summary);
    }
  };

  return (
    <div className="space-y-6">
      {/* Shipping selector — drives the invoice total below */}
      <ShippingOptions
        vehicleId="won-invoice"
        vehiclePriceEur={hammerEur}
        value={shipping}
        onChange={setShipping}
        hideTotal
        hideSaveQuote
      />

      {/* Invoice */}
      <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <Receipt className="size-4" />
            </span>
            <h2 className="text-lg font-bold text-grey-900">Invoice</h2>
          </div>
          <CurrencyPills />
        </div>

        <dl className="mt-5 space-y-1.5 text-sm">
          <Row label="Vehicle" value={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} strong />
          <Row label="VIN" value={vehicle.vin || "—"} sub />
          <Row label="Location" value={`${vehicle.city}, ${vehicle.country}`} sub />
        </dl>

        <div className="mt-5 border-t border-grey-100 pt-5 space-y-2.5">
          <LineItem label="Hammer price" value={format(hammerEur)} />
          <LineItem label="Platform fee (5%)" value={format(feeEur)} />
          <LineItem
            label={describeShipping(shipping)}
            value={format(shippingEur)}
            sub="Selected delivery method"
          />
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-grey-200 pt-5">
          <span className="text-xs font-bold uppercase tracking-wide text-grey-500">Total due</span>
          <span className="text-3xl font-extrabold tabular-nums text-brand-700">{format(totalEur)}</span>
        </div>
      </section>

      {/* Deadline + payment instructions */}
      <section className="rounded-2xl border border-warning-200 bg-warning-50/70 p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-warning-200">
            <Clock className="size-5 text-warning-700" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-warning-700">
              Payment due within 5 working days
            </p>
            <p className="mt-1 text-lg font-extrabold text-grey-900">{formatDeadline(deadline)}</p>
            <p className="mt-1 text-sm font-semibold text-warning-700">{formatRemaining(deadline, now)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
          <Building2 className="size-5 text-brand-600" />
          Payment instructions
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-grey-700">
          Wire transfer to <span className="font-semibold text-grey-900">Bradshaw Automation</span>{" "}
          within <span className="font-semibold text-grey-900">5 working days</span>.
          Shipping or warehouse pickup begins upon payment confirmation.
        </p>

        <div className="mt-4 rounded-lg bg-grey-50 px-4 py-3 ring-1 ring-grey-200">
          <p className="text-sm text-grey-600">
            Bank details will be sent to your registered email
            {userEmail ? <span className="font-medium text-grey-900"> ({userEmail})</span> : null}.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={shareInvoice}
          className="mt-4 h-10 gap-2 text-sm"
        >
          <Share2 className="size-4" />
          Share invoice summary
        </Button>
      </section>
    </div>
  );
}

function Row({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={sub ? "text-grey-500" : "text-grey-600"}>{label}</dt>
      <dd className={strong ? "font-semibold text-grey-900" : sub ? "text-grey-500" : "text-grey-700"}>
        {value}
      </dd>
    </div>
  );
}

function LineItem({ label, sub, value }: { label: string; sub?: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-grey-800 truncate">{label}</p>
        {sub && <p className="text-[11px] text-grey-500">{sub}</p>}
      </div>
      <p className="text-sm font-bold tabular-nums text-grey-900">{value}</p>
    </div>
  );
}
