"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { reviewCounterOfferAction } from "@/app/(admin)/admin/counter-offers/actions";

export function CounterOfferActions({
  offerId,
  status,
}: {
  offerId: string;
  status: "pending" | "accepted" | "rejected" | "expired";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status !== "pending") {
    return <span className="text-xs text-grey-400">No action</span>;
  }

  const review = (decision: "accepted" | "rejected") => {
    startTransition(async () => {
      const res = await reviewCounterOfferAction({ offerId, decision });
      if (!res.ok) {
        toast.err("Couldn't update offer", res.error);
        return;
      }
      toast.ok(decision === "accepted" ? "Offer accepted" : "Offer rejected");
      router.refresh();
    });
  };

  return (
    <div className="inline-flex gap-2">
      <Button
        size="sm"
        variant="outline"
        className="text-success-700 hover:bg-success-50"
        onClick={() => review("accepted")}
        disabled={isPending}
      >
        <Check className="size-3.5" /> Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-error-700 hover:bg-error-50"
        onClick={() => review("rejected")}
        disabled={isPending}
      >
        <X className="size-3.5" /> Reject
      </Button>
    </div>
  );
}
