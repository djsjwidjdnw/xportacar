"use client";

// Admin editor for the live shipping_rates table. Edit price / transit days,
// toggle active, or add a new route — all upsert by route_key and take effect
// immediately on the buyer-facing pages (which read the same table).

import { useState, useTransition } from "react";
import { Plus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { saveShippingRateAction, toggleShippingRateAction } from "@/app/(admin)/admin/settings/actions";
import { FALLBACK_RATES, type ShippingRate } from "@/lib/shipping";

const METHODS = ["roro", "container", "door_to_door", "warehouse", "service"];
const EMPTY = { route_key: "", method: "roro", destination_port: "", base_price_eur: "", transit_days_min: "", transit_days_max: "" };

export function ShippingRatesEditor({ initialRates }: { initialRates: ShippingRate[] }) {
  const [rows, setRows] = useState<ShippingRate[]>(initialRates.length ? initialRates : FALLBACK_RATES);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const patch = (rk: string, p: Partial<ShippingRate>) =>
    setRows((rs) => rs.map((r) => (r.route_key === rk ? { ...r, ...p } : r)));

  const save = (row: ShippingRate) => start(async () => {
    const res = await saveShippingRateAction({
      route_key: row.route_key, origin_port: row.origin_port, destination_port: row.destination_port,
      method: row.method, base_price_eur: Number(row.base_price_eur) || 0, rate_pct: row.rate_pct,
      transit_days_min: row.transit_days_min, transit_days_max: row.transit_days_max,
      active: row.active, notes: row.notes, sort_order: row.sort_order,
    });
    if (!res.ok) toast.err("Save failed", res.error);
    else toast.ok("Rate saved", row.destination_port ?? row.route_key);
  });

  const toggle = (row: ShippingRate) => start(async () => {
    const next = !row.active;
    patch(row.route_key, { active: next });
    const res = await toggleShippingRateAction(row.route_key, next);
    if (!res.ok) { patch(row.route_key, { active: row.active }); toast.err("Update failed", res.error); }
  });

  const addRoute = () => start(async () => {
    if (!form.route_key.trim()) { toast.err("Route key required"); return; }
    const res = await saveShippingRateAction({
      route_key: form.route_key.trim(), method: form.method, origin_port: "Dubai (Jebel Ali)",
      destination_port: form.destination_port || null, base_price_eur: Number(form.base_price_eur) || 0,
      transit_days_min: form.transit_days_min ? Number(form.transit_days_min) : null,
      transit_days_max: form.transit_days_max ? Number(form.transit_days_max) : null, active: true, sort_order: 100,
    });
    if (!res.ok) { toast.err("Couldn't add route", res.error); return; }
    toast.ok("Route added", form.route_key);
    setRows((rs) => [...rs, {
      id: form.route_key, route_key: form.route_key, origin_port: "Dubai (Jebel Ali)",
      destination_port: form.destination_port || null, method: form.method,
      base_price_eur: Number(form.base_price_eur) || 0, rate_pct: null,
      transit_days_min: form.transit_days_min ? Number(form.transit_days_min) : null,
      transit_days_max: form.transit_days_max ? Number(form.transit_days_max) : null,
      active: true, notes: null, sort_order: 100,
    }]);
    setForm(EMPTY); setAdding(false);
  });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-grey-200 text-left text-[11px] uppercase tracking-wide text-grey-500">
              <th className="py-2 pr-3">Route</th>
              <th className="py-2 pr-3">Price €</th>
              <th className="py-2 pr-3">Days</th>
              <th className="py-2 pr-3">Active</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.route_key} className={`border-b border-grey-100 ${row.active ? "" : "opacity-50"}`}>
                <td className="py-2 pr-3">
                  <p className="font-semibold text-grey-900">{row.destination_port ?? row.route_key.replace(/_/g, " ")}</p>
                  <p className="text-[11px] uppercase text-grey-400">{row.method.replace(/_/g, "-")}</p>
                </td>
                <td className="py-2 pr-3">
                  <Input
                    type="number" inputMode="numeric" value={String(row.base_price_eur)}
                    onChange={(e) => patch(row.route_key, { base_price_eur: Number(e.currentTarget.value || 0) })}
                    className="h-9 w-24 tabular-nums"
                  />
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1">
                    <Input type="number" value={row.transit_days_min == null ? "" : String(row.transit_days_min)}
                      onChange={(e) => patch(row.route_key, { transit_days_min: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
                      className="h-9 w-14 tabular-nums" placeholder="min" />
                    <span className="text-grey-400">–</span>
                    <Input type="number" value={row.transit_days_max == null ? "" : String(row.transit_days_max)}
                      onChange={(e) => patch(row.route_key, { transit_days_max: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
                      className="h-9 w-14 tabular-nums" placeholder="max" />
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <input type="checkbox" checked={row.active} onChange={() => toggle(row)} disabled={pending}
                    className="size-4 rounded border-grey-300 text-brand-600" />
                </td>
                <td className="py-2">
                  <Button size="sm" variant="outline" onClick={() => save(row)} disabled={pending} className="h-9 gap-1.5">
                    <Save className="size-3.5" /> Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="mt-4 grid gap-2 rounded-xl border border-grey-200 bg-grey-50 p-3 sm:grid-cols-6">
          <Input value={form.route_key} onChange={(e) => setForm({ ...form, route_key: e.currentTarget.value })} placeholder="route_key" className="h-9 sm:col-span-2" />
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.currentTarget.value })} className="h-9 rounded-lg border border-grey-200 px-2 text-sm">
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Input value={form.destination_port} onChange={(e) => setForm({ ...form, destination_port: e.currentTarget.value })} placeholder="Port" className="h-9" />
          <Input type="number" value={form.base_price_eur} onChange={(e) => setForm({ ...form, base_price_eur: e.currentTarget.value })} placeholder="Price €" className="h-9" />
          <div className="flex gap-2">
            <Button size="sm" onClick={addRoute} disabled={pending} className="h-9 flex-1">Add</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="h-9">Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="mt-4 gap-1.5">
          <Plus className="size-4" /> Add route
        </Button>
      )}
    </div>
  );
}
