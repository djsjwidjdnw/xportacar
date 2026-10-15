"use client";

// Write-only key field for the Integrations page. The key goes straight from
// this browser to admin_set_market_price_key() (admin-only, stores it in
// Supabase Vault, returns at most the last 4 characters). It is never shown,
// never kept in state after saving, and never sent to the web server.

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

export type MarketKeyName = "market_vincario_api_key" | "market_vincario_secret_key" | "market_apify_token";

const FRIENDLY: Record<string, string> = {
  ADMIN_ONLY: "Admin only.",
  INVALID_KEY_FORMAT: "That doesn't look like a key: 8 to 512 characters, no spaces.",
  UNKNOWN_KEY: "Unknown key.",
};

export function IntegrationKeyField({
  name, label, isSet, last4, updatedAt,
}: {
  name: MarketKeyName;
  label: string;
  isSet: boolean;
  last4: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  const write = async (clear: boolean) => {
    if (clear && !window.confirm(`Remove the ${label}? Market prices switch off while a key is missing.`)) return;
    setPending(true);
    const pasted = clear ? "" : value;
    setValue("");
    try {
      const { data, error } = await createClient().rpc("admin_set_market_price_key", { p_name: name, p_value: pasted });
      if (error) {
        toast.err("Couldn't save the key", FRIENDLY[error.message] ?? error.message);
        return;
      }
      toast.ok(clear ? "Key removed" : "Key saved", clear ? undefined : `Stored in Vault, ends in ${String(data ?? "")}.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`key-${name}`} className="text-sm font-medium text-grey-800">{label}</label>
        <span className={isSet ? "font-mono text-xs font-semibold text-grey-900" : "text-xs font-semibold text-warning-700"}>
          {isSet ? `••••${last4 ?? ""}` : "Not set"}
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          id={`key-${name}`}
          type="password"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          placeholder={isSet ? "Paste a new key to replace it" : "Paste the key"}
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          className="font-mono"
        />
        <Button size="sm" className="h-8" onClick={() => write(false)} disabled={pending || value.trim().length < 8}>
          {isSet ? "Replace" : "Save"}
        </Button>
        {isSet && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => write(true)} disabled={pending}>
            Clear
          </Button>
        )}
      </div>
      {isSet && updatedAt && (
        <p className="text-[11px] text-grey-500">
          Last changed {new Date(updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
