"use client";

// Admin edit for a vehicle in ANY state (Task 5). Edits all scalar vehicle
// details + pricing + status + auction end-time + inspector notes. Pricing /
// end-time changes on a live auction are audit-logged server-side.
//
// NOTE: photo / damage / document CRUD is intentionally out of this dialog —
// it's a larger media-management surface tracked separately.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { updateVehicleAction, type VehicleEdit } from "@/app/(admin)/admin/actions";
import type { VehicleStatus } from "@/types";

const STATUSES: VehicleStatus[] = [
  "draft", "inspection_scheduled", "inspected", "pending_review", "changes_requested",
  "listed", "in_auction", "sold", "payment_pending", "paid", "collected", "shipped", "delivered",
];
const FUELS = ["petrol", "diesel", "hybrid", "electric"];
const TRANSMISSIONS = ["automatic", "manual"];

export interface EditVehicleValues {
  vin: string; make: string; model: string; year: number; mileage_km: number;
  fuel_type: string; transmission: string;
  drivetrain: string | null; engine: string | null; body_type: string | null;
  market_spec: string | null; exterior_color: string | null; interior_color: string | null;
  location_city: string; location_country: string; inspection_notes: string | null;
  listed_price_eur: number | null; reserve_price_eur: number | null; buy_now_price_eur: number | null;
  status: VehicleStatus;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-grey-600">{label}</Label>
      {children}
    </div>
  );
}

// "" → null for nullable text columns; trimmed otherwise.
const nz = (s: string): string | null => (s.trim() === "" ? null : s.trim());
const num = (s: string): number | null => (s.trim() === "" ? null : Number(s.replace(/[^0-9.]/g, "")));

export function EditVehicleDialog({
  vehicleId, vehicle, auction,
}: {
  vehicleId: string;
  vehicle: EditVehicleValues;
  auction?: { id: string; end_time: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [f, setF] = useState({
    vin: vehicle.vin ?? "", make: vehicle.make ?? "", model: vehicle.model ?? "",
    year: String(vehicle.year ?? ""), mileage_km: String(vehicle.mileage_km ?? ""),
    fuel_type: vehicle.fuel_type ?? "petrol", transmission: vehicle.transmission ?? "automatic",
    drivetrain: vehicle.drivetrain ?? "", engine: vehicle.engine ?? "", body_type: vehicle.body_type ?? "",
    market_spec: vehicle.market_spec ?? "", exterior_color: vehicle.exterior_color ?? "", interior_color: vehicle.interior_color ?? "",
    location_city: vehicle.location_city ?? "", location_country: vehicle.location_country ?? "",
    inspection_notes: vehicle.inspection_notes ?? "",
    listed_price_eur: vehicle.listed_price_eur != null ? String(vehicle.listed_price_eur) : "",
    reserve_price_eur: vehicle.reserve_price_eur != null ? String(vehicle.reserve_price_eur) : "",
    buy_now_price_eur: vehicle.buy_now_price_eur != null ? String(vehicle.buy_now_price_eur) : "",
    status: vehicle.status,
  });
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const [endAt, setEndAt] = useState(
    auction?.end_time ? toLocalInput(auction.end_time) : "",
  );

  const set = (k: keyof typeof f, val: string) => setF((p) => ({ ...p, [k]: val }));

  const submit = () => {
    start(async () => {
      const edit: VehicleEdit = {
        vin: f.vin.trim(), make: f.make.trim(), model: f.model.trim(),
        year: Number(f.year) || vehicle.year, mileage_km: num(f.mileage_km) ?? 0,
        fuel_type: f.fuel_type, transmission: f.transmission,
        drivetrain: nz(f.drivetrain), engine: nz(f.engine), body_type: nz(f.body_type),
        market_spec: nz(f.market_spec), exterior_color: nz(f.exterior_color), interior_color: nz(f.interior_color),
        location_city: f.location_city.trim() || "Dubai", location_country: f.location_country.trim() || "UAE",
        inspection_notes: nz(f.inspection_notes),
        listed_price_eur: num(f.listed_price_eur), reserve_price_eur: num(f.reserve_price_eur),
        buy_now_price_eur: num(f.buy_now_price_eur), status: f.status,
      };
      // Only send a new end time if the admin actually changed it.
      const newEndISO = endAt && auction && toLocalInput(auction.end_time) !== endAt
        ? new Date(endAt).toISOString() : null;
      const res = await updateVehicleAction(vehicleId, edit, newEndISO);
      if (!res.ok) { toast.err("Couldn't save changes", res.error); return; }
      toast.ok("Vehicle updated", "Changes saved" + (auction ? " (auction synced)." : "."));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline" className="w-full gap-1.5">
          <Pencil className="size-4" />
          Edit vehicle
        </Button>
      } />
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit vehicle</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="VIN"><Input value={f.vin} onChange={(e) => set("vin", e.currentTarget.value.toUpperCase())} maxLength={17} /></Field>
            <Field label="Make"><Input value={f.make} onChange={(e) => set("make", e.currentTarget.value)} /></Field>
            <Field label="Model"><Input value={f.model} onChange={(e) => set("model", e.currentTarget.value)} /></Field>
            <Field label="Year"><Input value={f.year} inputMode="numeric" onChange={(e) => set("year", e.currentTarget.value.replace(/[^0-9]/g, ""))} maxLength={4} /></Field>
            <Field label="Mileage (km)"><Input value={f.mileage_km} inputMode="numeric" onChange={(e) => set("mileage_km", e.currentTarget.value.replace(/[^0-9]/g, ""))} /></Field>
            <Field label="Market spec"><Input value={f.market_spec} onChange={(e) => set("market_spec", e.currentTarget.value)} placeholder="GCC Specs" /></Field>
            <Field label="Fuel">
              <Select value={f.fuel_type} onValueChange={(v) => set("fuel_type", v ?? "petrol")}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{FUELS.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Transmission">
              <Select value={f.transmission} onValueChange={(v) => set("transmission", v ?? "automatic")}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TRANSMISSIONS.map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Drivetrain"><Input value={f.drivetrain} onChange={(e) => set("drivetrain", e.currentTarget.value)} placeholder="AWD" /></Field>
            <Field label="Engine"><Input value={f.engine} onChange={(e) => set("engine", e.currentTarget.value)} placeholder="3.0L I6" /></Field>
            <Field label="Body type"><Input value={f.body_type} onChange={(e) => set("body_type", e.currentTarget.value)} placeholder="SUV" /></Field>
            <Field label="Exterior color"><Input value={f.exterior_color} onChange={(e) => set("exterior_color", e.currentTarget.value)} /></Field>
            <Field label="Interior color"><Input value={f.interior_color} onChange={(e) => set("interior_color", e.currentTarget.value)} /></Field>
            <Field label="City"><Input value={f.location_city} onChange={(e) => set("location_city", e.currentTarget.value)} /></Field>
            <Field label="Country"><Input value={f.location_country} onChange={(e) => set("location_country", e.currentTarget.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Listed / starting (€)"><Input value={f.listed_price_eur} inputMode="numeric" onChange={(e) => set("listed_price_eur", e.currentTarget.value.replace(/[^0-9]/g, ""))} /></Field>
            <Field label="Reserve (€)"><Input value={f.reserve_price_eur} inputMode="numeric" onChange={(e) => set("reserve_price_eur", e.currentTarget.value.replace(/[^0-9]/g, ""))} placeholder="none" /></Field>
            <Field label="Buy now (€)"><Input value={f.buy_now_price_eur} inputMode="numeric" onChange={(e) => set("buy_now_price_eur", e.currentTarget.value.replace(/[^0-9]/g, ""))} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={f.status} onValueChange={(v) => set("status", (v ?? f.status) as VehicleStatus)}>
                <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((x) => <SelectItem key={x} value={x}>{x.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {auction && (
              <Field label="Auction end time">
                <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.currentTarget.value)} />
              </Field>
            )}
          </div>

          <Field label="Inspector notes">
            <textarea
              value={f.inspection_notes}
              onChange={(e) => set("inspection_notes", e.currentTarget.value)}
              rows={3}
              className="w-full rounded-md border border-grey-300 bg-white px-3 py-2 text-sm text-grey-900 outline-none focus:border-brand-500"
            />
          </Field>

          {auction && (
            <p className="text-xs text-grey-500">
              This vehicle has an auction — price/reserve/buy-now and end-time changes are recorded in the admin audit log.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ISO (UTC) → local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
