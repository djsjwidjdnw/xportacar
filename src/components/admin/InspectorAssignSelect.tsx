"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { assignInspectorAction } from "@/app/(admin)/admin/actions";

interface Inspector { id: string; full_name: string | null; email: string | null }

const UNASSIGNED = "__unassigned__";

export function InspectorAssignSelect({
  vehicleId,
  currentInspectorId,
  inspectors,
  compact = false,
}: {
  vehicleId: string;
  currentInspectorId: string | null;
  inspectors: Inspector[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentInspectorId ?? UNASSIGNED);
  const [isPending, startTransition] = useTransition();

  const onChange = (raw: string | null) => {
    const next = raw ?? UNASSIGNED;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await assignInspectorAction(
        vehicleId,
        next === UNASSIGNED ? null : next,
      );
      if (!res.ok) {
        setValue(prev);
        toast.err("Couldn't assign inspector", res.error);
        return;
      }
      const inspector = inspectors.find((i) => i.id === next);
      toast.ok(next === UNASSIGNED
        ? "Inspector unassigned"
        : `Assigned to ${inspector?.full_name ?? inspector?.email ?? "inspector"}`);
      router.refresh();
    });
  };

  return (
    <Select value={value} onValueChange={onChange} disabled={isPending}>
      <SelectTrigger className={compact ? "h-7 text-xs" : "h-9 w-full"}>
        <SelectValue placeholder="Assign inspector" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>— Unassigned</SelectItem>
        {inspectors.map((i) => (
          <SelectItem key={i.id} value={i.id}>{i.full_name ?? i.email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
