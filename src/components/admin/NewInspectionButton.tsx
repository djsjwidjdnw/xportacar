"use client";

// "New Inspection" — admin schedules an inspection in one dialog:
//   • pick an existing un-inspected vehicle (status draft/listed), OR
//   • create a new vehicle inline (make/model/year/VIN/seller),
// then assign an inspector. On "Assign" the vehicle moves to
// status = inspection_scheduled with inspector_id set.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { scheduleInspectionAction } from "@/app/(admin)/admin/actions";

interface Inspector { id: string; full_name: string | null; email: string | null }
interface VehicleOption { id: string; year: number; make: string; model: string; vin: string; status: string }

const EMPTY_VEHICLE = { make: "", model: "", year: "", vin: "", sellerName: "", sellerPhone: "" };

export function NewInspectionButton({
  inspectors,
  availableVehicles,
}: {
  inspectors: Inspector[];
  availableVehicles: VehicleOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [mode, setMode] = useState<"existing" | "new">(availableVehicles.length > 0 ? "existing" : "new");
  // Selects use `null` for "nothing chosen" — base-ui's Select crashes if it is
  // given a controlled value (e.g. "") that matches none of its items.
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [inspectorId, setInspectorId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_VEHICLE);

  // Defensive: read the value whether base-ui hands us a native event or a
  // raw string, and never let an onChange throw and unmount the dialog.
  const set = (k: keyof typeof EMPTY_VEHICLE) =>
    (e: React.ChangeEvent<HTMLInputElement> | string) => {
      try {
        const value = typeof e === "string" ? e : (e?.currentTarget?.value ?? e?.target?.value ?? "");
        setForm((f) => ({ ...f, [k]: value }));
      } catch (err) {
        console.error("NewInspectionButton input onChange failed", err);
      }
    };

  const newVehicleValid = !!form.make.trim() && !!form.model.trim() && !!form.vin.trim() && !!form.year.trim();
  const canAssign = !!inspectorId && (mode === "existing" ? !!vehicleId : newVehicleValid);

  const reset = () => {
    setMode(availableVehicles.length > 0 ? "existing" : "new");
    setVehicleId(null); setInspectorId(null); setForm(EMPTY_VEHICLE);
  };

  const inspectorLabel = useMemo(() => {
    const i = inspectors.find((x) => x.id === inspectorId);
    return i ? (i.full_name ?? i.email ?? "inspector") : "";
  }, [inspectorId, inspectors]);

  const submit = () => {
    start(async () => {
      const res = await scheduleInspectionAction({
        mode,
        vehicleId: mode === "existing" ? vehicleId : null,
        newVehicle: mode === "new"
          ? {
              make: form.make, model: form.model, year: Number(form.year), vin: form.vin,
              sellerName: form.sellerName, sellerPhone: form.sellerPhone,
            }
          : undefined,
        inspectorId: inspectorId ?? "",
      });
      if (!res.ok) { toast.err("Couldn't schedule inspection", res.error); return; }
      toast.ok("Inspection scheduled", `Assigned to ${inspectorLabel || "inspector"}.`);
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={
        <Button className="gap-1.5">
          <ClipboardPlus className="size-4" />
          New Inspection
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule a new inspection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-grey-100 p-1">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                mode === "existing" ? "bg-white text-grey-900 shadow-xs" : "text-grey-500 hover:text-grey-700"
              }`}
            >
              Existing vehicle
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                mode === "new" ? "bg-white text-grey-900 shadow-xs" : "text-grey-500 hover:text-grey-700"
              }`}
            >
              New vehicle
            </button>
          </div>

          {mode === "existing" ? (
            <Field label="Vehicle">
              {availableVehicles.length === 0 ? (
                <p className="rounded-lg border border-dashed border-grey-300 px-3 py-2 text-xs text-grey-500">
                  No un-inspected vehicles. Switch to “New vehicle” to add one.
                </p>
              ) : (
                <Select value={vehicleId} onValueChange={(v) => setVehicleId((v as string | null) ?? null)} disabled={pending}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select a vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} · {v.vin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Make"><Input value={form.make} onChange={set("make")} placeholder="BMW" /></Field>
                <Field label="Model"><Input value={form.model} onChange={set("model")} placeholder="X5" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year"><Input value={form.year} onChange={set("year")} inputMode="numeric" placeholder="2023" /></Field>
                <Field label="VIN"><Input value={form.vin} onChange={set("vin")} placeholder="WBA1234567890XXXX" className="font-mono" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Seller name"><Input value={form.sellerName} onChange={set("sellerName")} placeholder="Ahmed Al Rashid" /></Field>
                <Field label="Seller phone"><Input value={form.sellerPhone} onChange={set("sellerPhone")} inputMode="tel" placeholder="+971 50 …" /></Field>
              </div>
            </div>
          )}

          {/* Inspector */}
          <Field label="Inspector">
            {inspectors.length === 0 ? (
              <p className="rounded-lg border border-dashed border-grey-300 px-3 py-2 text-xs text-grey-500">
                No inspectors yet. Create an inspector account in Users first.
              </p>
            ) : (
              <Select value={inspectorId} onValueChange={(v) => setInspectorId((v as string | null) ?? null)} disabled={pending}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Select an inspector" />
                </SelectTrigger>
                <SelectContent>
                  {inspectors.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.full_name ?? "—"}{i.email ? ` · ${i.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <p className="text-xs text-grey-500">
            The vehicle moves to status{" "}
            <span className="font-semibold text-grey-700">Inspection scheduled</span> and the inspector is notified.
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending}>Cancel</Button>} />
          <Button onClick={submit} disabled={pending || !canAssign}>
            {pending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-grey-700">{label}</span>
      {children}
    </label>
  );
}
