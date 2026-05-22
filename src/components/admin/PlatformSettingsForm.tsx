"use client";

// Editable form for the four read/write fields in the platform settings
// JSON.  Read-only chrome (Resend / Stripe / Storage statuses) stays in
// the page itself — this component only owns the mutable inputs.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

import {
  type PlatformSettings, DEFAULT_PLATFORM_SETTINGS,
} from "@/lib/platform-settings-shared";
import { savePlatformSettingsAction } from "@/app/(admin)/admin/settings/actions";

export function PlatformSettingsForm({ initial }: { initial: PlatformSettings }) {
  const router = useRouter();
  const [values, setValues] = useState<PlatformSettings>(initial);
  const [saving, startSave] = useTransition();

  const dirty =
    values.platformName        !== initial.platformName ||
    values.feePercentage       !== initial.feePercentage ||
    values.defaultAuctionDays  !== initial.defaultAuctionDays ||
    values.minBidIncrementEur  !== initial.minBidIncrementEur;

  const onSave = () => {
    startSave(async () => {
      const res = await savePlatformSettingsAction(values);
      if (!res.ok) { toast.err("Couldn't save", res.error); return; }
      toast.ok("Settings saved", "Platform configuration updated.");
      router.refresh();
    });
  };

  const onReset = () => setValues(DEFAULT_PLATFORM_SETTINGS);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Platform name"
          hint="Shown in invoices and emails."
        >
          <Input
            value={values.platformName}
            onChange={(e) => setValues({ ...values, platformName: e.currentTarget.value })}
            className="h-10"
          />
        </Field>

        <Field
          label="Platform fee (%)"
          hint="Added on top of the hammer price; auto-flows to invoices."
        >
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={50}
            step={0.5}
            value={values.feePercentage}
            onChange={(e) => setValues({ ...values, feePercentage: Number(e.currentTarget.value) })}
            className="h-10 tabular-nums"
          />
        </Field>

        <Field
          label="Default auction duration (days)"
          hint="Used when an admin opens a new auction with no explicit end date."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={values.defaultAuctionDays}
            onChange={(e) => setValues({ ...values, defaultAuctionDays: Number(e.currentTarget.value) })}
            className="h-10 tabular-nums"
          />
        </Field>

        <Field
          label="Minimum bid increment (€)"
          hint="Floor for the tiered increment ladder. Bids below the current step are rejected."
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={50}
            value={values.minBidIncrementEur}
            onChange={(e) => setValues({ ...values, minBidIncrementEur: Number(e.currentTarget.value) })}
            className="h-10 tabular-nums"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          variant="ghost"
          onClick={onReset}
          disabled={saving}
          className="h-10 gap-2"
        >
          <RotateCcw className="size-4" />
          Reset to defaults
        </Button>
        <Button
          onClick={onSave}
          disabled={!dirty || saving}
          className="h-10 gap-2"
        >
          <Save className="size-4" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-grey-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-grey-500">{hint}</span>}
    </label>
  );
}
