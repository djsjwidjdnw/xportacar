"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Power, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  toggleLandingMode, setCountdown, clearCountdown, exportSignupsCSV,
} from "@/app/(admin)/admin/prelaunch/actions";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PrelaunchControls({
  landingMode, countdownTarget,
}: {
  landingMode: boolean;
  countdownTarget: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dt, setDt] = useState(toLocalInput(countdownTarget));

  const onToggle = () => {
    const next = !landingMode;
    if (!next && !window.confirm("This will show the marketplace publicly. Continue?")) return;
    startTransition(async () => {
      const res = await toggleLandingMode(next);
      if (!res.ok) return toast.err("Couldn't update", res.error);
      toast.ok(next ? "Landing page is now live" : "Marketplace is now public");
      router.refresh();
    });
  };

  const onSetCountdown = () => {
    if (!dt) return toast.err("Pick a date", "Choose a launch date and time first.");
    const iso = new Date(dt).toISOString();
    startTransition(async () => {
      const res = await setCountdown(iso);
      if (!res.ok) return toast.err("Couldn't set countdown", res.error);
      toast.ok("Countdown set");
      router.refresh();
    });
  };

  const onClearCountdown = () => {
    startTransition(async () => {
      const res = await clearCountdown();
      if (!res.ok) return toast.err("Couldn't clear countdown", res.error);
      setDt("");
      toast.ok("Countdown cleared");
      router.refresh();
    });
  };

  const onExport = () => {
    startTransition(async () => {
      const res = await exportSignupsCSV();
      if (!res.ok || !res.csv) return toast.err("Export failed", res.error);
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prelaunch-signups-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6">
      {/* Landing mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 grid size-9 place-items-center rounded-lg ${landingMode ? "bg-success-50 text-success-600" : "bg-grey-100 text-grey-500"}`}>
            <Power className="size-5" />
          </div>
          <div>
            <p className="font-bold text-grey-900">Landing page mode</p>
            <p className="text-sm text-grey-600">
              {landingMode
                ? "ON — visitors see the pre-launch landing page."
                : "OFF — visitors see the normal marketplace homepage."}
            </p>
          </div>
        </div>
        <Button onClick={onToggle} disabled={pending} variant={landingMode ? "outline" : "default"}>
          {landingMode ? "Turn off (show marketplace)" : "Turn on (show landing)"}
        </Button>
      </div>

      {/* Countdown */}
      <div className="rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center gap-2">
          <Timer className="size-5 text-brand-600" />
          <p className="font-bold text-grey-900">Launch countdown</p>
        </div>
        <p className="mb-3 text-sm text-grey-600">
          {countdownTarget
            ? `Currently counting down to ${new Date(countdownTarget).toLocaleString("en-GB")}.`
            : "No countdown set — the landing page hides the timer."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            className="h-10 rounded-lg border border-grey-300 bg-white px-3 text-sm text-grey-900"
          />
          <Button onClick={onSetCountdown} disabled={pending}>Set countdown</Button>
          {countdownTarget && (
            <Button onClick={onClearCountdown} disabled={pending} variant="outline">Clear countdown</Button>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-grey-200 bg-white p-5 shadow-xs">
        <div>
          <p className="font-bold text-grey-900">Export signups</p>
          <p className="text-sm text-grey-600">Download all signups as CSV (email, country, date).</p>
        </div>
        <Button onClick={onExport} disabled={pending} variant="outline">
          <Download className="size-4" /> Download CSV
        </Button>
      </div>
    </div>
  );
}
