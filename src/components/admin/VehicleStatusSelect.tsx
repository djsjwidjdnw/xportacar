"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { setVehicleStatusAction } from "@/app/(admin)/admin/actions";
import type { VehicleStatus } from "@/types";

const OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "draft",                label: "Draft" },
  { value: "inspection_scheduled", label: "Inspection scheduled" },
  { value: "inspected",            label: "Inspected" },
  { value: "listed",               label: "Listed" },
  { value: "in_auction",           label: "In auction" },
  { value: "sold",                 label: "Sold" },
  { value: "payment_pending",      label: "Payment pending" },
  { value: "paid",                 label: "Paid" },
  { value: "collected",            label: "Collected" },
  { value: "shipped",              label: "Shipped" },
  { value: "delivered",            label: "Delivered" },
];

export function VehicleStatusSelect({
  vehicleId,
  currentStatus,
  compact = false,
}: {
  vehicleId: string;
  currentStatus: VehicleStatus;
  compact?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<VehicleStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  const onChange = (next: VehicleStatus) => {
    const prev = status;
    setStatus(next); // optimistic
    startTransition(async () => {
      const res = await setVehicleStatusAction(vehicleId, next);
      if (!res.ok) {
        setStatus(prev);
        toast.err("Status change failed", res.error);
        return;
      }
      toast.ok("Status updated", OPTIONS.find((o) => o.value === next)?.label);
      router.refresh();
    });
  };

  return (
    <Select value={status} onValueChange={(v) => onChange(v as VehicleStatus)} disabled={isPending}>
      <SelectTrigger className={compact ? "h-7 text-xs" : "h-9 w-full"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
