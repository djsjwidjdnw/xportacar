"use client";

// Shipping/delivery options selector — radio-style picker covering
// warehouse pickup, the 4 EU port options, door-to-door delivery, and the
// optional German TÜV / papers service.  The selected option's cost is
// summed with the vehicle price and shown as a live total estimate.

import { useMemo, useState, useTransition } from "react";
import { Ship, Home, FileText, Box } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CurrencyPills } from "@/components/buyer/CurrencyPills";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export type ShippingChoice =
  | { kind: "warehouse" }
  | { kind: "port"; port: string }
  | { kind: "door" }
  | { kind: "tuv" };

export interface PortOption {
  port: string;
  country: string;
  priceEur: number;
  days: number;
}

export const PORT_OPTIONS: PortOption[] = [
  { port: "Hamburg",   country: "Germany",     priceEur: 1800, days: 28 },
  { port: "Rotterdam", country: "Netherlands", priceEur: 1600, days: 25 },
  { port: "Genoa",     country: "Italy",       priceEur: 2100, days: 22 },
  { port: "Barcelona", country: "Spain",       priceEur: 2200, days: 24 },
];

export const DOOR_RANGE_EUR = { min: 2800, max: 4500 };
export const TUV_PRICE_EUR = 750;

export function getShippingPriceEur(choice: ShippingChoice): number {
  switch (choice.kind) {
    case "warehouse": return 0;
    case "port":      return PORT_OPTIONS.find((p) => p.port === choice.port)?.priceEur ?? 0;
    case "door":      return DOOR_RANGE_EUR.min;
    case "tuv":       return TUV_PRICE_EUR;
  }
}

export function describeShipping(choice: ShippingChoice): string {
  switch (choice.kind) {
    case "warehouse": return "Warehouse Pickup (Dubai)";
    case "port":      return `Nearest Port — ${choice.port}`;
    case "door":      return "Door-to-Door Delivery";
    case "tuv":       return "German TÜV / Papers Service";
  }
}

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
  // Optional controlled mode — when present, the selector becomes a
  // controlled component and the parent owns the choice (used by the
  // won-screen invoice so its totals update with this picker).
  value?: ShippingChoice;
  onChange?: (next: ShippingChoice) => void;
  hideTotal?: boolean;
  hideSaveQuote?: boolean;
}) {
  const { format } = useCurrency();
  const [internal, setInternal] = useState<ShippingChoice>({ kind: "port", port: "Hamburg" });
  const choice = value ?? internal;
  const setChoice = (next: ShippingChoice) => {
    if (onChange) onChange(next);
    else setInternal(next);
  };
  const [saving, startSave] = useTransition();

  const shippingEur = getShippingPriceEur(choice);
  const total = (vehiclePriceEur ?? 0) + shippingEur;
  const doorRange = useMemo(
    () => `${format(DOOR_RANGE_EUR.min)} – ${format(DOOR_RANGE_EUR.max)} estimated`,
    [format],
  );

  const saveQuote = () => {
    if (choice.kind !== "port") {
      toast.err("Choose a port", "Quote saving is only available for port delivery options.");
      return;
    }
    const port = PORT_OPTIONS.find((p) => p.port === choice.port);
    if (!port) return;
    startSave(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("shipping_quotes").insert({
        vehicle_id: vehicleId,
        buyer_id:   user?.id ?? null,
        destination: port.port,
        cost_eur:    port.priceEur,
        transit_days: port.days,
        carrier:     `RoRo · ${port.port}`,
      });
      if (error) {
        toast.err("Couldn't save quote", error.message);
        return;
      }
      toast.ok("Quote saved", `${port.port} · ${format(port.priceEur)}`);
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
      <p className="mt-2 text-xs text-grey-500">
        Choose how the vehicle reaches you. Prices reflect the selected currency.
      </p>

      <div className="mt-5 space-y-3">
        <OptionRow
          active={choice.kind === "warehouse"}
          onClick={() => setChoice({ kind: "warehouse" })}
          icon={<Box className="size-4" />}
          title="Warehouse Pickup (Dubai)"
          subtitle="Available immediately after payment"
          priceLabel="Free"
        />

        <div className={cn(
          "rounded-lg border bg-grey-50/50 p-3",
          choice.kind === "port" ? "border-brand-300" : "border-grey-200",
        )}>
          <div className="flex items-center gap-2 px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-grey-500">
            <Ship className="size-3.5" />
            Nearest Port Delivery (RoRo from Jebel Ali)
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {PORT_OPTIONS.map((p) => {
              const active = choice.kind === "port" && choice.port === p.port;
              return (
                <button
                  key={p.port}
                  type="button"
                  onClick={() => setChoice({ kind: "port", port: p.port })}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-brand-500 ring-1 ring-brand-200"
                      : "border-grey-200 hover:border-grey-300",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Radio active={active} />
                    <div>
                      <p className="text-sm font-semibold text-grey-900">{p.port}, {p.country}</p>
                      <p className="text-[11px] text-grey-500">{p.days} days</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-grey-900">{format(p.priceEur)}</p>
                </button>
              );
            })}
          </div>
        </div>

        <OptionRow
          active={choice.kind === "door"}
          onClick={() => setChoice({ kind: "door" })}
          icon={<Home className="size-4" />}
          title="Door-to-Door Delivery"
          subtitle="30–45 days · varies by destination"
          priceLabel={doorRange}
        />

        <OptionRow
          active={choice.kind === "tuv"}
          onClick={() => setChoice({ kind: "tuv" })}
          icon={<FileText className="size-4" />}
          title="German TÜV / Papers Service"
          subtitle="Inspection for DE registration, CoC, customs paperwork"
          priceLabel={`+ ${format(TUV_PRICE_EUR)}`}
        />
      </div>

      {/* Live total */}
      {!hideTotal && (
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">Total estimate</p>
            <p className="text-2xl font-extrabold tabular-nums text-brand-700">{format(total)}</p>
          </div>
          <p className="mt-1 text-xs text-grey-600">
            {format(vehiclePriceEur ?? 0)} vehicle + {format(shippingEur)} {describeShipping(choice)}
          </p>
          {!hideSaveQuote && choice.kind === "port" && (
            <div className="mt-3 flex justify-end">
              <Button
                onClick={saveQuote}
                disabled={saving}
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] font-semibold text-brand-700 hover:underline"
              >
                {saving ? "Saving…" : "Save this quote"}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function OptionRow({
  active, onClick, icon, title, subtitle, priceLabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  priceLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left transition-colors",
        active
          ? "border-brand-500 ring-1 ring-brand-200 bg-brand-50/40"
          : "border-grey-200 hover:border-grey-300",
      )}
    >
      <Radio active={active} />
      <span className={cn(
        "grid size-8 place-items-center rounded-lg text-brand-700",
        active ? "bg-brand-600 text-white" : "bg-brand-50 ring-1 ring-brand-100",
      )}>
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
    <span className={cn(
      "grid size-4 place-items-center rounded-full border-2",
      active ? "border-brand-600" : "border-grey-300",
    )}>
      {active && <span className="size-2 rounded-full bg-brand-600" />}
    </span>
  );
}
