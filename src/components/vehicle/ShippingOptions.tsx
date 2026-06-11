"use client";

// Shipping/delivery selector. Prices come LIVE from the admin-editable
// shipping_rates table (src/lib/shipping.ts, 1-hour cached) with a seeded
// fallback. Warehouse pickup, the EU RoRo ports, door-to-door, and German TÜV.

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Ship, Home, FileText, Box } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { CustomsDisclaimer } from "@/components/shared/CustomsDisclaimer";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  getShippingRates, portRoutes, serviceRate, getShippingPriceEur, describeShipping,
  PORT_FLAT_EUR, FALLBACK_RATES, type ShippingChoice, type ShippingRate,
} from "@/lib/shipping";

// Re-export so existing consumers (WonInvoice) keep importing from here.
export { getShippingPriceEur, describeShipping };
export type { ShippingChoice };

const PORT_COUNTRY: Record<string, string> = {
  Hamburg: "Germany", Rotterdam: "Netherlands", Bremerhaven: "Germany",
  Antwerp: "Belgium", Genoa: "Italy", Barcelona: "Spain",
};

export function ShippingOptions({
  vehicleId,
  vehiclePriceEur,
  value,
  onChange,
  hideTotal,
  hideSaveQuote,
}: {
  vehicleId: string;
  vehiclePriceEur: number | null;
  value?: ShippingChoice;
  onChange?: (next: ShippingChoice) => void;
  hideTotal?: boolean;
  hideSaveQuote?: boolean;
}) {
  const { format } = useCurrency();
  const [rates, setRates] = useState<ShippingRate[]>(FALLBACK_RATES);
  const [internal, setInternal] = useState<ShippingChoice>({ method: { kind: "port", port: "Hamburg" }, tuv: false });
  const choice = value ?? internal;
  const setChoice = (next: ShippingChoice) => { if (onChange) onChange(next); else setInternal(next); };
  const setMethod = (method: ShippingChoice["method"]) => setChoice({ ...choice, method });
  const toggleTuv = () => setChoice({ ...choice, tuv: !choice.tuv });
  const [saving, startSave] = useTransition();

  // Live rates (cached 1h) — falls back to the seed while loading / offline.
  useEffect(() => { let on = true; getShippingRates().then((r) => { if (on) setRates(r); }); return () => { on = false; }; }, []);

  const roro = useMemo(() => portRoutes(rates, "roro"), [rates]);
  const doorPrice = serviceRate(rates, "door_to_door_eu")?.base_price_eur ?? 800;
  const tuvPrice = serviceRate(rates, "service_tuv")?.base_price_eur ?? 3500;

  const shippingEur = getShippingPriceEur(choice, rates);
  const total = (vehiclePriceEur ?? 0) + shippingEur;

  const saveQuote = () => {
    if (choice.method.kind !== "port") {
      toast.err("Choose a port", "Quote saving is only available for port delivery options.");
      return;
    }
    const port = choice.method.port;
    const route = roro.find((p) => p.destination_port === port);
    if (!route) return;
    startSave(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("shipping_quotes").insert({
        vehicle_id: vehicleId,
        buyer_id:   user?.id ?? null,
        destination: route.destination_port,
        cost_eur:    PORT_FLAT_EUR,
        transit_days: route.transit_days_min,
        carrier:     `RoRo · ${route.destination_port}`,
      });
      if (error) { toast.err("Couldn't save quote", error.message); return; }
      toast.ok("Quote saved", `${route.destination_port} · ${format(PORT_FLAT_EUR)}`);
    });
  };

  return (
    <section className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Ship className="size-4" />
          </span>
          <h2 className="text-lg font-bold text-grey-900">Shipping &amp; Delivery</h2>
        </div>
        <CurrencyPills />
      </div>
      <p className="mt-2 text-xs text-grey-500">Live rates · prices reflect the selected currency.</p>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-grey-500">Delivery method</p>
      <div className="mt-2 space-y-3">
        <OptionRow
          active={choice.method.kind === "warehouse"}
          onClick={() => setMethod({ kind: "warehouse" })}
          icon={<Box className="size-4" />}
          title="Warehouse Pickup (Dubai)"
          subtitle="Available immediately after payment"
          priceLabel="Free"
        />

        <div className={cn("rounded-lg border bg-grey-50/50 p-3", choice.method.kind === "port" ? "border-brand-300" : "border-grey-200")}>
          <div className="flex items-center gap-2 px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-grey-500">
            <Ship className="size-3.5" />
            Nearest Port Delivery (RoRo from Jebel Ali)
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {roro.map((p) => {
              const active = choice.method.kind === "port" && choice.method.port === p.destination_port;
              return (
                <button
                  key={p.route_key}
                  type="button"
                  onClick={() => setMethod({ kind: "port", port: p.destination_port! })}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 text-left transition-colors",
                    active ? "border-brand-500 ring-1 ring-brand-200" : "border-grey-200 hover:border-grey-300",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Radio active={active} />
                    <div>
                      <p className="text-sm font-semibold text-grey-900">
                        {p.destination_port}{PORT_COUNTRY[p.destination_port ?? ""] ? `, ${PORT_COUNTRY[p.destination_port!]}` : ""}
                      </p>
                      <p className="text-[11px] text-grey-500">{p.transit_days_min}–{p.transit_days_max} days</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-grey-900">{format(PORT_FLAT_EUR)}</p>
                </button>
              );
            })}
          </div>
        </div>

        <OptionRow
          active={choice.method.kind === "door"}
          onClick={() => setMethod({ kind: "door" })}
          icon={<Home className="size-4" />}
          title="Door-to-Door Delivery"
          subtitle="Added on top of the port rate · 30–45 days"
          priceLabel={`from ${format(doorPrice)}`}
        />
      </div>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-grey-500">Add-on service</p>
      {/* TÜV is an additive checkbox — combinable with ANY delivery method. */}
      <button
        type="button"
        onClick={toggleTuv}
        className={cn(
          "mt-2 flex w-full items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-colors",
          choice.tuv ? "border-brand-500 ring-1 ring-brand-200 bg-brand-50/40" : "border-grey-200 hover:border-grey-300",
        )}
      >
        <span className={cn(
          "grid size-5 shrink-0 place-items-center rounded border-2",
          choice.tuv ? "border-brand-600 bg-brand-600 text-white" : "border-grey-300",
        )}>
          {choice.tuv && <Check className="size-3.5" />}
        </span>
        <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <FileText className="size-4" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-grey-900">German Registration (TÜV)</span>
          <span className="block text-[11px] text-grey-500">Inspection for DE registration, CoC, customs paperwork</span>
        </span>
        <span className="text-sm font-bold text-brand-700">+ {format(tuvPrice)}</span>
      </button>

      <CustomsDisclaimer className="mt-4" />

      {!hideTotal && (
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Total estimate</p>
            <p className="text-2xl font-extrabold tabular-nums text-brand-700">{format(total)}</p>
          </div>
          <p className="mt-1 text-xs text-grey-600">
            {format(vehiclePriceEur ?? 0)} vehicle + {format(shippingEur)} {describeShipping(choice)}
          </p>
          {!hideSaveQuote && choice.method.kind === "port" && (
            <div className="mt-3 flex justify-end">
              <Button onClick={saveQuote} disabled={saving} variant="ghost" size="sm" className="h-7 text-[11px] font-semibold text-brand-700 hover:underline">
                {saving ? "Saving…" : "Save this quote"}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OptionRow({ active, onClick, icon, title, subtitle, priceLabel }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; priceLabel: string;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(
      "flex w-full items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-colors",
      active ? "border-brand-500 ring-1 ring-brand-200 bg-brand-50/40" : "border-grey-200 hover:border-grey-300",
    )}>
      <Radio active={active} />
      <span className={cn("grid size-8 place-items-center rounded-lg text-brand-700", active ? "bg-brand-600 text-white" : "bg-brand-50 ring-1 ring-brand-100")}>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-grey-900">{title}</span>
        <span className="block text-[11px] text-grey-500">{subtitle}</span>
      </span>
      <span className="text-sm font-bold text-brand-700">{priceLabel}</span>
    </button>
  );
}

function Radio({ active }: { active: boolean }) {
  return (
    <span className={cn("grid size-4 place-items-center rounded-full border-2", active ? "border-brand-600" : "border-grey-300")}>
      {active && <span className="size-2 rounded-full bg-brand-600" />}
    </span>
  );
}
