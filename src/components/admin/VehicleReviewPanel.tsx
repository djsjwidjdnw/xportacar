"use client";

// Admin review actions for a pending_review / changes_requested vehicle:
//   a. Approve & List      → status listed (live on marketplace)
//   b. Request Changes     → status changes_requested + notes back to inspector
//   c. Edit & List         → edit price/description inline, then list

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, MessageSquareWarning, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  approveAndListAction, requestChangesAction, updateListingAndListAction,
} from "@/app/(admin)/admin/actions";

export function VehicleReviewPanel({
  vehicleId,
  listedPriceEur,
  reservePriceEur,
  buyNowPriceEur,
  description,
}: {
  vehicleId: string;
  listedPriceEur: number | null;
  reservePriceEur: number | null;
  buyNowPriceEur: number | null;
  description: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<null | "changes" | "edit">(null);

  const [notes, setNotes] = useState("");
  const [listed, setListed]   = useState(listedPriceEur != null ? String(listedPriceEur) : "");
  const [reserve, setReserve] = useState(reservePriceEur != null ? String(reservePriceEur) : "");
  const [buyNow, setBuyNow]   = useState(buyNowPriceEur != null ? String(buyNowPriceEur) : "");
  const [desc, setDesc]       = useState(description ?? "");

  const approve = () => start(async () => {
    const res = await approveAndListAction(vehicleId);
    if (!res.ok) { toast.err("Couldn't approve", res.error); return; }
    toast.ok("Approved & listed", "The vehicle is now live on the marketplace.");
    router.refresh();
  });

  const sendBack = () => start(async () => {
    const res = await requestChangesAction(vehicleId, notes);
    if (!res.ok) { toast.err("Couldn't send back", res.error); return; }
    toast.ok("Sent back to inspector", "They'll see your notes on their dashboard.");
    setMode(null); setNotes("");
    router.refresh();
  });

  const editAndList = () => start(async () => {
    const res = await updateListingAndListAction(vehicleId, {
      listed_price_eur: listed ? Number(listed) : null,
      reserve_price_eur: reserve ? Number(reserve) : null,
      buy_now_price_eur: buyNow ? Number(buyNow) : null,
      description: desc.trim() || null,
    });
    if (!res.ok) { toast.err("Couldn't list", res.error); return; }
    toast.ok("Updated & listed", "The vehicle is now live on the marketplace.");
    setMode(null);
    router.refresh();
  });

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 shadow-xs">
      <p className="text-sm font-bold text-grey-900">Review actions</p>
      <p className="mt-0.5 text-xs text-grey-600">Approve to publish, request changes, or edit then list.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Button onClick={approve} disabled={pending} className="gap-1.5 bg-success-600 text-white hover:bg-success-700">
          <Check className="size-4" /> Approve &amp; List
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          aria-expanded={mode === "changes"}
          onClick={() => setMode(mode === "changes" ? null : "changes")}
          className="gap-1.5"
        >
          <MessageSquareWarning className="size-4" /> Request Changes
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          aria-expanded={mode === "edit"}
          onClick={() => setMode(mode === "edit" ? null : "edit")}
          className="gap-1.5"
        >
          <PencilLine className="size-4" /> Edit &amp; List
        </Button>
      </div>

      {mode === "changes" && (
        <div className="mt-4 space-y-2 rounded-xl border border-grey-200 bg-warning-50 p-3">
          <Label className="text-xs font-semibold text-warning-700">What needs fixing?</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            rows={3}
            placeholder="e.g. Re-take the engine bay photo, confirm the mileage, lower the starting price…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode(null)} disabled={pending}>Cancel</Button>
            <Button size="sm" onClick={sendBack} disabled={pending || !notes.trim()}>
              {pending ? "Sending…" : "Send back to inspector"}
            </Button>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="mt-4 space-y-3 rounded-xl border border-grey-200 bg-white p-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="Listed (€)"><Input value={listed} onChange={(e) => setListed(e.currentTarget.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></Field>
            <Field label="Reserve (€)"><Input value={reserve} onChange={(e) => setReserve(e.currentTarget.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></Field>
            <Field label="Buy now (€)"><Input value={buyNow} onChange={(e) => setBuyNow(e.currentTarget.value.replace(/[^0-9]/g, ""))} inputMode="numeric" /></Field>
          </div>
          <Field label="Description">
            <Textarea value={desc} onChange={(e) => setDesc(e.currentTarget.value)} rows={3} placeholder="Buyer-facing description…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode(null)} disabled={pending}>Cancel</Button>
            <Button size="sm" onClick={editAndList} disabled={pending || !listed}>
              {pending ? "Listing…" : "Save & List"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label className="mb-1 block text-[11px] font-medium text-grey-600">{label}</Label>
      {children}
    </label>
  );
}
