"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { setApifyActorAction } from "@/app/(admin)/admin/integrations/actions";

// The Apify Store actor used for Dubizzle Motors comparables
// (app_settings.market_prices_apify_actor). Swappable without a deploy; a
// replacement must accept startUrls + maxItems and return price, year,
// kilometers, make and model. Use Test lookup to check a swap.
export function ApifyActorField({ actor }: { actor: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(actor ?? "");
  const [pending, start] = useTransition();
  const changed = value.trim() !== (actor ?? "");

  const save = () => start(async () => {
    const res = await setApifyActorAction(value);
    if (!res.ok) { toast.err("Couldn't save the actor", res.error); return; }
    toast.ok("Actor saved", value.trim());
    router.refresh();
  });

  return (
    <div className="space-y-1.5">
      <label htmlFor="apify-actor" className="text-sm font-medium text-grey-800">Dubizzle actor (Apify Store)</label>
      <div className="flex gap-2">
        <Input id="apify-actor" value={value} onChange={(e) => setValue(e.currentTarget.value)} spellCheck={false} className="font-mono" />
        <Button size="sm" variant="outline" className="h-8" onClick={save} disabled={pending || !changed || !value.trim()}>
          Save
        </Button>
      </div>
      <p className="text-[11px] text-grey-500">
        Chosen 2026-10-15: 99.4% of 2,366 public runs succeeded in the last 30 days, $0.95 per 1,000 results + $0.005 a run,
        returns price, year, kilometers, make, model and trim. Each run is capped at 50 results and $0.10.
      </p>
    </div>
  );
}
