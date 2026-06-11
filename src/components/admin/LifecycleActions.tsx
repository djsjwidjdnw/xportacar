"use client";

// Admin lifecycle controls on a sold vehicle: shows the current status and the
// single next-step button (sold → picked_up → in_transit → delivered) with an
// optional note that's recorded on the event + emailed to the buyer.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, PackageCheck, MapPin, CheckCircle2 } from "lucide-react";
import { setLifecycleStatusAction, type LifecycleStatus } from "@/app/(admin)/admin/vehicles/lifecycle-actions";

const STEP: Record<string, { next: LifecycleStatus; label: string; Icon: typeof Truck } | null> = {
  sold:       { next: "picked_up",  label: "Mark as Picked Up", Icon: PackageCheck },
  picked_up:  { next: "in_transit", label: "Mark as In Transit", Icon: Truck },
  in_transit: { next: "delivered",  label: "Mark as Delivered", Icon: CheckCircle2 },
  delivered:  null,
};

const BADGE: Record<string, string> = {
  sold:       "bg-brand-50 text-brand-700 ring-brand-100",
  picked_up:  "bg-warning-50 text-warning-700 ring-warning-100",
  in_transit: "bg-warning-50 text-warning-700 ring-warning-100",
  delivered:  "bg-success-50 text-success-700 ring-success-100",
};

const LABEL: Record<string, string> = {
  sold: "Sold", picked_up: "Picked up", in_transit: "In transit", delivered: "Delivered",
};

export function LifecycleActions({ vehicleId, currentStatus }: { vehicleId: string; currentStatus: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Only relevant once a vehicle is sold or further along.
  if (!(currentStatus in STEP)) return null;
  const step = STEP[currentStatus];

  const run = () => {
    if (!step) return;
    setError(null);
    start(async () => {
      const res = await setLifecycleStatusAction({ vehicleId, next: step.next, note: note.trim() || undefined });
      if (!res.ok) { setError(res.error ?? "Failed."); return; }
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="mt-5 border-t border-grey-100 pt-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey-500">Delivery status</p>
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="size-4 text-grey-400" />
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${BADGE[currentStatus] ?? "bg-grey-100 text-grey-700 ring-grey-200"}`}>
          {LABEL[currentStatus] ?? currentStatus}
        </span>
      </div>

      {step ? (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note (tracking info, confirmation…)"
            className="mb-2 h-10 w-full rounded-lg border border-grey-200 px-3 text-sm"
          />
          <button
            onClick={run}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <step.Icon className="size-4" />
            {pending ? "Updating…" : step.label}
          </button>
          {error && <p className="mt-2 text-xs text-error-600">{error}</p>}
        </>
      ) : (
        <p className="text-sm text-success-700">Delivered — order complete.</p>
      )}
    </div>
  );
}
