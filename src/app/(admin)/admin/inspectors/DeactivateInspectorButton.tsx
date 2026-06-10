"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { deactivateInspectorAction } from "./actions";

// Demotes an inspector back to a buyer. Guarded by a confirm() since it
// revokes staff access; matches the inline-action style used elsewhere.
export function DeactivateInspectorButton({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm(`Deactivate ${name}? They'll be moved back to a buyer account and lose inspector access.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deactivateInspectorAction(userId);
      if (!res.ok) {
        toast.err("Deactivate failed", res.error);
        return;
      }
      toast.ok("Inspector deactivated");
      router.refresh();
    });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-[11px] text-error-700 hover:bg-error-50 hover:text-error-800"
      disabled={isPending}
      onClick={onClick}
    >
      <UserMinus className="size-3.5" />
      Deactivate
    </Button>
  );
}
