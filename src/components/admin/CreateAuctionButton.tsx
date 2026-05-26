"use client";

// Create (or replace) the auction for a listed vehicle. Pre-fills pricing from
// the vehicle, lets the admin pick a duration + start time, then flips the
// vehicle to in_auction so it goes live on the marketplace with a countdown.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";

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
import { createAuctionAction } from "@/app/(admin)/admin/actions";

const DURATIONS = [
  { value: "24",  label: "24 hours" },
  { value: "48",  label: "48 hours" },
  { value: "72",  label: "72 hours" },
  { value: "120", label: "5 days" },
  { value: "168", label: "7 days" },
];

export function CreateAuctionButton({
  vehicleId,
  listedPriceEur,
  reservePriceEur,
  buyNowPriceEur,
  size = "sm",
  variant = "default",
  label = "Create Auction",
}: {
  vehicleId: string;
  listedPriceEur: number | null;
  reservePriceEur: number | null;
  buyNowPriceEur: number | null;
  size?: "xs" | "sm" | "default";
  variant?: "default" | "outline";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [starting, setStarting] = useState(listedPriceEur != null ? String(listedPriceEur) : "");
  const [reserve, setReserve]   = useState(reservePriceEur != null ? String(reservePriceEur) : "");
  const [buyNow, setBuyNow]     = useState(buyNowPriceEur != null ? String(buyNowPriceEur) : "");
  const [duration, setDuration] = useState("168");
  const [startMode, setStartMode] = useState<"now" | "schedule">("now");
  const [startAt, setStartAt]   = useState("");

  const submit = () => {
    start(async () => {
      const res = await createAuctionAction({
        vehicleId,
        startingPriceEur: Number(starting),
        reservePriceEur: reserve ? Number(reserve) : null,
        buyNowPriceEur: buyNow ? Number(buyNow) : null,
        durationHours: Number(duration),
        startMode,
        startTimeISO: startMode === "schedule" && startAt ? new Date(startAt).toISOString() : null,
      });
      if (!res.ok) { toast.err("Couldn't create auction", res.error); return; }
      toast.ok("Auction created", startMode === "now" ? "Live now on the marketplace." : "Scheduled to start later.");
      setOpen(false);
      router.refresh();
    });
  };

  const valid = !!starting && Number(starting) > 0 && (startMode === "now" || !!startAt);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size={size} variant={variant} className="gap-1.5">
          <Gavel className="size-4" />
          {label}
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create auction</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starting price (€)">
              <Input value={starting} onChange={(e) => setStarting(e.currentTarget.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="35000" />
            </Field>
            <Field label="Reserve (€)">
              <Input value={reserve} onChange={(e) => setReserve(e.currentTarget.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="optional" />
            </Field>
          </div>
          <Field label="Buy now (€) — optional">
            <Input value={buyNow} onChange={(e) => setBuyNow(e.currentTarget.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="e.g. 48000" />
          </Field>

          <Field label="Duration">
            <Select value={duration} onValueChange={(v) => setDuration(v ?? "168")}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Start">
            <Select value={startMode} onValueChange={(v) => setStartMode((v as "now" | "schedule") ?? "now")}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Start now</SelectItem>
                <SelectItem value="schedule">Schedule for later</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {startMode === "schedule" && (
            <Field label="Start time">
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.currentTarget.value)} />
            </Field>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending}>Cancel</Button>} />
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? "Creating…" : "Create auction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label className="mb-1 block text-xs font-medium text-grey-700">{label}</Label>
      {children}
    </label>
  );
}
