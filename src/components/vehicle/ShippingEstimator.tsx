"use client";

// Hard-coded shipping table from UAE (Jebel Ali) to common EU ports.
// Saves a quote row in shipping_quotes when "Save this quote" is clicked.

import { useState, useTransition } from "react";
import { Ship, Clock, Anchor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { cn, formatEur } from "@/lib/utils";

const SHIPPING_TABLE = [
  { destination: "Hamburg",   carrier: "RoRo · MSC",   cost_eur: 1800, transit_days: 28 },
  { destination: "Rotterdam", carrier: "RoRo · CMA",   cost_eur: 1600, transit_days: 25 },
  { destination: "Genoa",     carrier: "RoRo · Grimaldi", cost_eur: 2100, transit_days: 22 },
  { destination: "Barcelona", carrier: "RoRo · MSC",   cost_eur: 2200, transit_days: 24 },
] as const;

export function ShippingEstimator({ vehicleId }: { vehicleId: string }) {
  const [dest, setDest] = useState<string>(SHIPPING_TABLE[0].destination);
  const [saving, startSave] = useTransition();

  const row = SHIPPING_TABLE.find((r) => r.destination === dest) ?? SHIPPING_TABLE[0];

  const save = () => {
    startSave(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("shipping_quotes").insert({
        vehicle_id: vehicleId,
        buyer_id:   user?.id ?? null,
        destination: row.destination,
        cost_eur:    row.cost_eur,
        transit_days: row.transit_days,
        carrier:     row.carrier,
      });
      if (error) {
        toast.err("Couldn't save quote", error.message);
        return;
      }
      toast.ok("Quote saved", `${row.destination} · ${formatEur(row.cost_eur)}`);
    });
  };

  return (
    <div className="rounded-2xl border border-grey-200 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <Ship className="size-4" />
          </span>
          <h2 className="text-lg font-bold text-grey-900">Shipping estimate</h2>
        </div>
      </div>
      <p className="mt-2 text-xs text-grey-500">From Jebel Ali, UAE — door-to-port. Customs & inland delivery quoted separately.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Select value={dest} onValueChange={(v) => setDest(v as string)}>
          <SelectTrigger className="h-11">
            <Anchor className="size-3.5 text-grey-500" />
            <SelectValue placeholder="Choose destination" />
          </SelectTrigger>
          <SelectContent>
            {SHIPPING_TABLE.map((r) => (
              <SelectItem key={r.destination} value={r.destination}>{r.destination}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="rounded-lg bg-grey-50 px-4 py-2.5 ring-1 ring-grey-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-grey-500">Estimate</p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-grey-900">
            {formatEur(row.cost_eur)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-grey-600">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {row.transit_days} days · {row.carrier}
        </span>
        <Button onClick={save} disabled={saving} variant="ghost" size="sm" className={cn("h-7 text-[11px] font-semibold text-brand-700 hover:underline", saving && "opacity-50")}>
          {saving ? "Saving…" : "Save this quote"}
        </Button>
      </div>
    </div>
  );
}
