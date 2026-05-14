"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { reviewKycSubmissionAction } from "@/app/(buyer)/profile/kyc-actions";

export function KycReviewActions({
  submissionId,
  status,
}: {
  submissionId: string;
  status: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status !== "pending") {
    return <span className="text-xs text-grey-400">Reviewed</span>;
  }

  const review = (decision: "approved" | "rejected") => {
    let note: string | undefined;
    if (decision === "rejected") {
      note = window.prompt("Reason for rejection (optional):") ?? undefined;
    }
    startTransition(async () => {
      const res = await reviewKycSubmissionAction({ submissionId, decision, note });
      if (!res.ok) {
        toast.err("Couldn't update KYC", res.error);
        return;
      }
      toast.ok(decision === "approved" ? "Buyer verified" : "Submission rejected");
      router.refresh();
    });
  };

  return (
    <div className="inline-flex gap-2">
      <Button size="sm" variant="outline" className="text-success-700 hover:bg-success-50" onClick={() => review("approved")} disabled={isPending}>
        <Check className="size-3.5" /> Approve
      </Button>
      <Button size="sm" variant="outline" className="text-error-700 hover:bg-error-50" onClick={() => review("rejected")} disabled={isPending}>
        <X className="size-3.5" /> Reject
      </Button>
    </div>
  );
}
