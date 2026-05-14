"use client";

import { useTransition } from "react";
import { CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createCheckoutSessionAction } from "@/app/(buyer)/auction/[id]/won/actions";

export function PayNowButton({
  invoiceId,
  stripeConfigured,
}: {
  invoiceId: string;
  stripeConfigured: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!stripeConfigured) {
    return (
      <Button disabled size="lg" variant="outline" className="h-12 w-full text-base">
        <CreditCard className="size-4" />
        Payment processing coming soon
      </Button>
    );
  }

  const pay = () => {
    startTransition(async () => {
      const res = await createCheckoutSessionAction({ invoiceId });
      if (!res.ok || !res.url) {
        toast.err("Couldn't start checkout", res.error);
        return;
      }
      window.location.href = res.url;
    });
  };

  return (
    <Button onClick={pay} disabled={isPending} size="lg" className="h-12 w-full text-base">
      <CreditCard className="size-4" />
      {isPending ? "Redirecting…" : "Pay now"}
    </Button>
  );
}
