"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { setUserRoleAction } from "@/app/(admin)/admin/actions";

const ROLES = [
  { value: "buyer",      label: "Buyer" },
  { value: "inspector",  label: "Inspector" },
  { value: "admin",      label: "Admin" },
  { value: "superadmin", label: "Superadmin" },
] as const;

type Role = (typeof ROLES)[number]["value"];

export function UserRoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: Role;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(currentRole);
  const [isPending, startTransition] = useTransition();

  const onChange = (next: Role) => {
    const prev = role;
    setRole(next);
    startTransition(async () => {
      const res = await setUserRoleAction(userId, next);
      if (!res.ok) {
        setRole(prev);
        toast.err("Role change failed", res.error);
        return;
      }
      toast.ok("Role updated", ROLES.find((r) => r.value === next)?.label);
      router.refresh();
    });
  };

  return (
    <Select value={role} onValueChange={(v) => onChange(v as Role)} disabled={isPending}>
      <SelectTrigger className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
