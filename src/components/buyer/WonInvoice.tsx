"use client";

// Invoice + two-step payment flow shown on /auction/[id]/won.
// Step 1: confirm intent to pay within 36 HOURS of winning.
// Step 2: once confirmed, complete the wire transfer within 5 WORKING DAYS.
// Lives client-side so the currency selector, live countdown and the confirm
// action can update without a full server round-trip.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Clock, Download, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { CustomsDisclaimer } from "@/components/shared/CustomsDisclaimer";
import { toast } from "@/components/ui/toast";
import { confirmPaymentAction } from "@/app/(buyer)/auction/[id]/won/actions";
import {
  ShippingOptions, type ShippingChoice,
} from "@/components/vehicle/ShippingOptions";
import {
  describeMethod, getMethodPriceEur, tuvPriceEur,
} from "@/lib/shipping";
import { useCurrency } from "@/lib/currency";

export const PLATFORM_FEE_PCT = 0.029;
const CONFIRM_WINDOW_HOURS = 36;
const PAYMENT_WORKING_DAYS = 5;

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
  if (ms <= 0) return "Window expired";
  const totalHours = Math.floor(ms / 3600_000);
  const days  = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0)  return `${days} day${days === 1 ? "" : "s"}, ${hours}h remaining`;
  const mins = Math.floor((ms % 3600_000) / 60_000);
  return `${hours}h ${mins}m remaining`;
}

export function WonInvoice({
  vehicle, hammerEur, userEmail,
  invoiceId, invoiceNumber, createdAtIso, confirmedAtIso,
}: {
  vehicle: { year: number; make: string; model: string; vin: string; city: string; country: string };
  hammerEur: number;
  userEmail: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAtIso: string | null;
  confirmedAtIso: string | null;
}) {
  const { format } = useCurrency();
  const router = useRouter();
  const [shipping, setShipping] = useState<ShippingChoice>({ method: { kind: "port", port: "Hamburg" }, tuv: false });
  const [now, setNow] = useState(() => new Date());
  const [confirming, startConfirm] = useTransition();

  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);

  const confirmed = !!confirmedAtIso;
  const createdAt = useMemo(() => (createdAtIso ? new Date(createdAtIso) : new Date()), [createdAtIso]);
  const confirmDeadline = useMemo(
    () => new Date(createdAt.getTime() + CONFIRM_WINDOW_HOURS * 3600_000),
    [createdAt],
  );
  const payDeadline = useMemo(
    () => addWorkingDays(confirmedAtIso ? new Date(confirmedAtIso) : new Date(), PAYMENT_WORKING_DAYS),
    [confirmedAtIso],
  );
  const confirmExpired = !confirmed && confirmDeadline.getTime() <= now.getTime();

  const feeEur = hammerEur * PLATFORM_FEE_PCT;
  const methodEur = getMethodPriceEur(shipping.method);
  const tuvEur = shipping.tuv ? tuvPriceEur() : 0;
  const totalEur = hammerEur + feeEur + methodEur + tuvEur;

  const pdfHref = invoiceId
    ? `/api/invoice/${invoiceId}/pdf?` +
      new URLSearchParams({
        shipping: describeMethod(shipping.method),
        shippingEur: String(methodEur),
        tuvEur: String(tuvEur),
      }).toString()
    : null;

  const confirm = () => {
    if (!invoiceId) return;
    startConfirm(async () => {
      const res = await confirmPaymentAction({ invoiceId });
      if (!res.ok) { toast.err("Couldn't confirm", res.error ?? "Try again."); return; }
      toast.ok("Payment confirmed", `Complete your wire transfer within ${PAYMENT_WORKING_DAYS} working days.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* STEP 1 — confirm intent to pay within 36 hours */}
      {!confirmed && (
        <section className={`rounded-2xl border p-6 ${confirmExpired ? "border-error-200 bg-error-50" : "border-warning-200 bg-warning-50/70"}`}>
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-warning-200">
              <Clock className={`size-5 ${confirmExpired ? "text-error-600" : "text-warning-700"}`} />
            </span>
            <div className="flex-1">
              <p className={`text-xs font-bold uppercase tracking-wide ${confirmExpired ? "text-error-700" : "text-warning-700"}`}>
                {confirmExpired ? "Confirmation window expired" : `Confirm payment within ${CONFIRM_WINDOW_HOURS} hours`}
              </p>
              {confirmExpired ? (
                <p className="mt-1 text-sm font-medium text-error-700">
                  You did not confirm in time, so this vehicle may be re-listed. Contact us if you still wish to proceed.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-lg font-extrabold text-grey-900">{formatDeadline(confirmDeadline)}</p>
                  <p className="mt-1 text-sm font-semibold text-warning-700">{formatRemaining(confirmDeadline, now)}</p>
                  <p className="mt-2 text-sm text-grey-700">
                    Confirm that you intend to pay. You&apos;ll then have{" "}
                    <span className="font-semibold text-grey-900">{PAYMENT_WORKING_DAYS} working days</span>{" "}
                    to complete the wire transfer.
                  </p>
                  <Button onClick={confirm} disabled={confirming || !invoiceId} className="mt-4 h-11">
                    <CheckCircle2 className="size-4" />
                    {confirming ? "Confirming…" : "Confirm payment"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* STEP 2 — confirmed: complete wire transfer within 5 working days */}
      {confirmed && (
        <section className="rounded-2xl border border-success-200 bg-success-50/70 p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white ring-1 ring-success-200">
              <CheckCircle2 className="size-5 text-success-700" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-success-700">
                Payment confirmed — complete wire transfer within {PAYMENT_WORKING_DAYS} working days
              </p>
              <p className="mt-1 text-lg font-extrabold text-grey-900">{formatDeadline(payDeadline)}</p>
              <p className="mt-1 text-sm font-semibold text-success-700">{formatRemaining(payDeadline, now)}</p>
              <p className="mt-2 text-xs text-grey-600">
                Late or missing payment after this deadline may incur late fees/charges.
              </p>
            </div>
          </div>
        </section>
      )}

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
            <div>
              <h2 className="text-lg font-bold text-grey-900">Invoice</h2>
              {invoiceNumber && <p className="font-mono text-xs text-grey-500">{invoiceNumber}</p>}
            </div>
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
          <LineItem label="Platform fee (2.9%)" value={format(feeEur)} />
          <LineItem
            label={describeMethod(shipping.method)}
            value={format(methodEur)}
            sub="Selected delivery method"
          />
          {shipping.tuv && (
            <LineItem label="German TÜV / Papers Service" value={format(tuvEur)} sub="Add-on service" />
          )}
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-grey-200 pt-5">
          <span className="text-xs font-bold uppercase tracking-wide text-grey-500">Total due</span>
          <span className="text-3xl font-extrabold tabular-nums text-brand-700">{format(totalEur)}</span>
        </div>

        <CustomsDisclaimer className="mt-5" />

        {pdfHref && (
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-grey-200 px-4 text-sm font-semibold text-grey-800 hover:bg-grey-50"
          >
            <Download className="size-4" />
            Download PDF invoice
          </a>
        )}
      </section>

      {/* Payment instructions */}
      <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-grey-900">
          <Building2 className="size-5 text-brand-600" />
          Payment instructions
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-grey-700">
          Pay by wire transfer to <span className="font-semibold text-grey-900">XportACar</span>{" "}
          (operated by Global Business Consultancy L.L.C-FZ) within{" "}
          <span className="font-semibold text-grey-900">{PAYMENT_WORKING_DAYS} working days</span> of confirming.
          Shipping or warehouse pickup begins upon payment confirmation.
        </p>

        <div className="mt-4 rounded-lg bg-grey-50 px-4 py-3 ring-1 ring-grey-200">
          <p className="text-sm text-grey-600">
            Bank details will be sent to your registered email
            {userEmail ? <span className="font-medium text-grey-900"> ({userEmail})</span> : null}.
          </p>
        </div>
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
