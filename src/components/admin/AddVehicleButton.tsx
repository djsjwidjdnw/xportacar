"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { createVehicleAction, assignInspectorAction } from "@/app/(admin)/admin/actions";

interface Inspector { id: string; full_name: string | null; email: string | null }

const EMPTY = { make: "", model: "", year: "", vin: "", sellerName: "", sellerPhone: "" };

export function AddVehicleButton({ inspectors = [] }: { inspectors?: Inspector[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState(EMPTY);

  // After a successful create we switch to an "assign inspector" step instead
  // of closing, so the new vehicle doesn't get stranded without an inspector.
  const [created, setCreated] = useState<{ id: string; label: string } | null>(null);
  // null = nothing selected; base-ui Select crashes on an unmatched value like "".
  const [inspectorId, setInspectorId] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.currentTarget.value }));

  const valid = !!form.make.trim() && !!form.model.trim() && !!form.vin.trim() && !!form.year.trim();

  const close = () => {
    setForm(EMPTY); setCreated(null); setInspectorId(null); setOpen(false);
  };

  const submit = () => {
    start(async () => {
      const res = await createVehicleAction({
        make: form.make,
        model: form.model,
        year: Number(form.year),
        vin: form.vin,
        sellerName: form.sellerName,
        sellerPhone: form.sellerPhone,
      });
      if (!res.ok || !res.id) {
        toast.err("Couldn't add vehicle", res.error);
        return;
      }
      toast.ok("Vehicle added", `${form.year} ${form.make} ${form.model} · inspection scheduled`);
      setCreated({ id: res.id, label: `${form.year} ${form.make} ${form.model}` });
      router.refresh();
    });
  };

  const assign = () => {
    if (!created || !inspectorId) return;
    start(async () => {
      const res = await assignInspectorAction(created.id, inspectorId);
      if (!res.ok) { toast.err("Couldn't assign inspector", res.error); return; }
      const ins = inspectors.find((i) => i.id === inspectorId);
      toast.ok("Inspector assigned", `${created.label} → ${ins?.full_name ?? ins?.email ?? "inspector"}`);
      close();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) close(); }}>
      <DialogTrigger render={
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add New Vehicle
        </Button>
      } />
      <DialogContent className="max-w-md">
        {created ? (
          /* Step 2 — assign an inspector to the just-created vehicle */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success-600" />
                Assign an inspector now?
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm text-grey-600">
                <span className="font-semibold text-grey-900">{created.label}</span> was created with status{" "}
                <span className="font-semibold text-grey-700">Inspection scheduled</span>. Pick who inspects it.
              </p>
              {inspectors.length === 0 ? (
                <p className="rounded-lg border border-dashed border-grey-300 px-3 py-2 text-xs text-grey-500">
                  No inspectors yet. Create an inspector account in Users first.
                </p>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-grey-700">Inspector</span>
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
                </label>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={pending}>Skip for now</Button>
              <Button onClick={assign} disabled={pending || !inspectorId}>
                {pending ? "Assigning…" : "Assign inspector"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Step 1 — vehicle details */
          <>
            <DialogHeader>
              <DialogTitle>Add new vehicle</DialogTitle>
            </DialogHeader>

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
              <p className="text-xs text-grey-500">
                Created with status <span className="font-semibold text-grey-700">Inspection scheduled</span>.
                You&apos;ll assign an inspector next.
              </p>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={pending}>Cancel</Button>} />
              <Button onClick={submit} disabled={pending || !valid}>
                {pending ? "Adding…" : "Add vehicle"}
              </Button>
            </DialogFooter>
          </>
        )}
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
