"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setMarketPricesEnabledAction } from "@/app/(admin)/admin/integrations/actions";

// Master switch for market prices. Refuses to switch on while a key is missing
// (disabled here, and enforced by a database trigger).
export function MarketPricesSwitch({ enabled, keysReady }: { enabled: boolean; keysReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !enabled;
    if (next && !window.confirm("Switch market prices on? From now on every publish or relist runs one Vincario lookup (about €1.99) and one Apify run (about $0.05) for that car, unless it was priced in the last 7 days.")) return;
    start(async () => {
      const res = await setMarketPricesEnabledAction(next);
      if (!res.ok) { toast.err(next ? "Couldn't switch market prices on" : "Couldn't switch market prices off", res.error); return; }
      toast.ok(next ? "Market prices are on" : "Market prices are off");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        onClick={toggle}
        disabled={pending || (!enabled && !keysReady)}
        variant={enabled ? "outline" : "default"}
        className="gap-1.5"
      >
        <Power className="size-4" />
        {pending ? "Saving…" : enabled ? "Switch off" : "Switch on"}
      </Button>
      {!enabled && !keysReady && (
        <p className="text-[11px] text-grey-500">Add the Vincario keys and the Apify token first.</p>
      )}
    </div>
  );
}
