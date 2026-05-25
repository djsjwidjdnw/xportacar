"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { createVehicleAction } from "@/app/(admin)/admin/actions";

const EMPTY = { make: "", model: "", year: "", vin: "", sellerName: "", sellerPhone: "" };

export function AddVehicleButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState(EMPTY);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.currentTarget.value }));

  const valid = !!form.make.trim() && !!form.model.trim() && !!form.vin.trim() && !!form.year.trim();

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
      if (!res.ok) {
        toast.err("Couldn't add vehicle", res.error);
        return;
      }
      toast.ok("Vehicle added", `${form.year} ${form.make} ${form.model} · inspection scheduled`);
      setForm(EMPTY);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add New Vehicle
        </Button>
      } />
      <DialogContent className="max-w-md">
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
            Assign an inspector from the vehicle&apos;s page.
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending}>Cancel</Button>} />
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? "Adding…" : "Add vehicle"}
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
