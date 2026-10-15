"use client";

// Integrations page: one live lookup per service for a chosen car, to confirm
// a key works (the result is saved to that car's market prices). Disabled
// while market prices are off; the Edge Function refuses it then as well.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

type Service = "vincario" | "apify";
interface SideResult { status: string; median: number | null; count: number | null; error: string | null }
interface Outcome { status?: string; reason?: string; missing?: string[]; error?: string; eu?: SideResult | null; uae?: SideResult | null }

async function bodyOf(error: unknown): Promise<Outcome | null> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== "function") return null;
  try { return (await ctx.json()) as Outcome; } catch { return null; }
}

function describe(service: Service, o: Outcome): string {
  if (o.status === "dormant") return o.reason === "keys_missing" ? `Dormant: missing ${(o.missing ?? []).join(", ")}` : "Dormant: market prices are off";
  if (o.status === "in_progress") return "A lookup for this car is already running; try again in a minute.";
  const s = service === "vincario" ? o.eu : o.uae;
  if (!s) return o.error ?? o.status ?? "No result";
  if (s.status === "ok") return `OK: median ${s.median} from ${s.count} listings`;
  return `${s.status}${s.error ? `: ${s.error}` : ""}`;
}

export function TestLookupPanel({
  enabled,
  vehicles,
}: {
  enabled: boolean;
  vehicles: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [running, setRunning] = useState<Service | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const run = async (service: Service) => {
    const what = service === "vincario" ? "one Vincario market value lookup (about €1.99)" : "one Apify run on Dubizzle Motors (about $0.05)";
    if (!window.confirm(`Run ${what} for this car now?`)) return;
    setRunning(service);
    try {
      const { data, error } = await createClient().functions.invoke("market-prices", {
        body: { action: "test", service, vehicle_id: vehicleId },
      });
      const outcome: Outcome = (error ? await bodyOf(error) : (data as Outcome)) ?? { error: error?.message ?? "No response" };
      const text = describe(service, outcome);
      setLast(`${service === "vincario" ? "Vincario" : "Apify"}: ${text}`);
      if (!error && (service === "vincario" ? outcome.eu : outcome.uae)?.status !== "error") toast.ok("Test lookup finished", text);
      else toast.err("Test lookup failed", text);
      router.refresh();
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor="test-vehicle" className="text-sm font-medium text-grey-800">Car to look up</label>
      <select
        id="test-vehicle"
        value={vehicleId}
        onChange={(e) => setVehicleId(e.currentTarget.value)}
        className="h-9 w-full rounded-lg border border-grey-300 bg-white px-2.5 text-sm text-grey-900"
        disabled={!vehicles.length}
      >
        {vehicles.length === 0 && <option value="">No vehicles yet</option>}
        {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <div className="flex flex-wrap gap-2">
        {(["vincario", "apify"] as const).map((s) => (
          <Button key={s} size="sm" variant="outline" className="gap-1.5" disabled={!enabled || !vehicleId || running !== null} onClick={() => run(s)}>
            <FlaskConical className="size-3.5" />
            {running === s ? "Running… (up to 2 min)" : `Test lookup: ${s === "vincario" ? "Vincario" : "Apify"}`}
          </Button>
        ))}
      </div>
      {!enabled && <p className="text-[11px] text-grey-500">Disabled while market prices are off.</p>}
      {last && <p className="rounded-lg bg-grey-50 px-3 py-2 font-mono text-[11px] text-grey-700 ring-1 ring-grey-200">{last}</p>}
    </div>
  );
}
