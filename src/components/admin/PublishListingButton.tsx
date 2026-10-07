"use client";

// Fixed-price marketplace: set the price and publish the vehicle for 7 days
// (also used to relist an expired listing, which restarts the 7 days, or to
// change the price of a live one).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { publishListingAction } from "@/app/(admin)/admin/actions";
import { LISTING_DAYS } from "@/lib/listing";

export function PublishListingButton({
  vehicleId,
  priceEur,
  label = "Publish listing",
  size = "sm",
  variant = "default",
}: {
  vehicleId: string;
  priceEur: number | null;
  label?: string;
  size?: "xs" | "sm" | "default";
  variant?: "default" | "outline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(priceEur != null ? String(Math.round(priceEur)) : "");
  const valid = Number(price) > 0;

  const submit = () => {
    start(async () => {
      const res = await publishListingAction({ vehicleId, priceEur: Number(price) });
      if (!res.ok) { toast.err("Couldn't publish the listing", res.error); return; }
      toast.ok("Listing published", `Live on the marketplace for ${LISTING_DAYS} days.`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size={size} variant={variant} className="gap-1.5">
          <CalendarClock className="size-4" />
          {label}
        </Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            The vehicle is listed at this fixed price for {LISTING_DAYS} days from now. Buyers purchase it
            instantly; the invoice adds the 2.9% platform fee and shipping. Unsold listings expire and can be relisted.
          </DialogDescription>
        </DialogHeader>
        <label className="block">
          <Label className="mb-1 block text-xs font-medium text-grey-700">Price (€)</Label>
          <Input
            value={price}
            onChange={(e) => setPrice(e.currentTarget.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="125000"
          />
        </label>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending}>Cancel</Button>} />
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? "Publishing…" : `Publish for ${LISTING_DAYS} days`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
