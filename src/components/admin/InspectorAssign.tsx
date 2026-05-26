"use client";

// Inspector assignment with two of the three methods inline: a dropdown
// picker (method A) and an "assign by email" input (method B). The round-robin
// auto-assign (method C) is the page-level <AutoAssignButton />.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, X } from "lucide-react";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { assignInspectorAction, assignInspectorByEmailAction } from "@/app/(admin)/admin/actions";

interface Inspector { id: string; full_name: string | null; email: string | null }

const UNASSIGNED = "__unassigned__";

export function InspectorAssign({
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
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  const onPick = (raw: string | null) => {
    const next = raw ?? UNASSIGNED;
    const prev = value;
    setValue(next);
    start(async () => {
      const res = await assignInspectorAction(vehicleId, next === UNASSIGNED ? null : next);
      if (!res.ok) { setValue(prev); toast.err("Couldn't assign inspector", res.error); return; }
      const ins = inspectors.find((i) => i.id === next);
      toast.ok(next === UNASSIGNED
        ? "Inspector unassigned"
        : `Assigned to ${ins?.full_name ?? ins?.email ?? "inspector"}`);
      router.refresh();
    });
  };

  const onEmail = () => {
    if (!email.trim()) return;
    start(async () => {
      const res = await assignInspectorByEmailAction(vehicleId, email);
      if (!res.ok) { toast.err("Couldn't assign", res.error); return; }
      toast.ok("Inspector assigned", `Assigned to ${res.inspectorName ?? email.trim()}`);
      setEmail(""); setEmailMode(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <Select value={value} onValueChange={onPick} disabled={pending}>
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

      {emailMode ? (
        <div className="flex items-center gap-1">
          <Input
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            placeholder="inspector@email.com"
            inputMode="email"
            className="h-7 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter") onEmail(); }}
          />
          <Button size="xs" onClick={onEmail} disabled={pending || !email.trim()}>Assign</Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => { setEmailMode(false); setEmail(""); }}
          >
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEmailMode(true)}
          className="inline-flex items-center gap-1 self-start text-[10px] font-semibold text-grey-500 hover:text-brand-700"
        >
          <AtSign className="size-3" />
          by email
        </button>
      )}
    </div>
  );
}
