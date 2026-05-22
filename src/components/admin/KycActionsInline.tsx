"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setUserKycStatusAction } from "@/app/(admin)/admin/actions";

type KycStatus = "pending" | "verified" | "rejected";

// Compact approve/reject pair shown inline in the users table. When the
// user is already verified we offer Reset (back to pending) so an admin
// can re-review without leaving the table.
export function KycActionsInline({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: KycStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<KycStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  const set = (next: KycStatus) => {
    const prev = status;
    setStatus(next);
    startTransition(async () => {
      const res = await setUserKycStatusAction(userId, next);
      if (!res.ok) {
        setStatus(prev);
        toast.err("KYC update failed", res.error);
        return;
      }
      toast.ok(
        next === "verified" ? "KYC verified" :
        next === "rejected" ? "KYC rejected" :
        "KYC reset to pending",
      );
      router.refresh();
    });
  };

  if (status === "verified") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px] text-grey-600"
        disabled={isPending}
        onClick={() => set("pending")}
      >
        <RotateCcw className="size-3" />
        Reset
      </Button>
    );
  }

  if (status === "rejected") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px] text-grey-600"
        disabled={isPending}
        onClick={() => set("pending")}
      >
        <RotateCcw className="size-3" />
        Reopen
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px] text-success-700 hover:bg-success-50 hover:text-success-800"
        disabled={isPending}
        onClick={() => set("verified")}
      >
        <Check className="size-3.5" />
        Approve
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-[11px] text-error-700 hover:bg-error-50 hover:text-error-800"
        disabled={isPending}
        onClick={() => set("rejected")}
      >
        <X className="size-3.5" />
        Reject
      </Button>
    </div>
  );
}
