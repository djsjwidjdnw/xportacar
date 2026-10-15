"use client";

// Admin: look the car's market prices up again now (both sides, ignoring the
// 7-day reuse). Calls the market-prices Edge Function from the browser with the
// admin's session, so a slow Apify run is not bound by a server-action timeout.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

interface SideResult { status: string; count: number | null; error: string | null }
interface Outcome {
  status?: string;
  reason?: string;
  missing?: string[];
  eu?: SideResult | null;
  uae?: SideResult | null;
}

const side = (label: string, s: SideResult | null | undefined) =>
  !s ? null : s.status === "ok" ? `${label}: ${s.count} listings` : `${label}: ${s.error ?? s.status}`;

export function MarketPricesRefreshButton({ vehicleId, disabled }: { vehicleId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = async () => {
    if (!window.confirm("Look up this car's UAE and EU market prices again now? This runs one paid Vincario lookup and one Apify run (about €2 in total).")) return;
    setPending(true);
    try {
      const { data, error } = await createClient().functions.invoke("market-prices", {
        body: { action: "lookup", vehicle_id: vehicleId, trigger: "refresh", force: true, wait: true },
      });
      const o = (data ?? {}) as Outcome;
      if (error) toast.err("Refresh failed", error.message);
      else if (o.status === "dormant") toast.info("Market prices are dormant", o.reason === "keys_missing" ? `Missing: ${(o.missing ?? []).join(", ")}` : "Switch them on in Integrations first.");
      else if (o.status === "in_progress") toast.info("A lookup is already running", "Reload in a minute.");
      else if (o.status === "done") toast.ok("Market prices refreshed", [side("UAE", o.uae), side("EU", o.eu)].filter(Boolean).join(" · "));
      else toast.info("Market prices", o.status ?? "No change");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1.5" disabled={disabled || pending} onClick={run}>
      <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} />
      {pending ? "Looking up… (up to 2 min)" : "Refresh market prices"}
    </Button>
  );
}
