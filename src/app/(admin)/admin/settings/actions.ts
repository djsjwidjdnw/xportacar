"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { savePlatformSettings, type PlatformSettings } from "@/lib/platform-settings";

export interface SettingsResult {
  ok: boolean;
  error?: string;
  settings?: PlatformSettings;
}

// Saves the editable platform-settings JSON. Admin-only; non-admin callers
// get a clean "Admin only" rejection rather than a generic RLS error.
export async function savePlatformSettingsAction(
  input: Partial<PlatformSettings>,
): Promise<SettingsResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    return { ok: false, error: "Admin only." };
  }

  const result = await savePlatformSettings(input);
  if (result.ok) revalidatePath("/admin/settings");
  return result;
}

// --------------------------------------------------------------------
// Shipping rates — admin-editable; upsert by route_key (edit OR add).
// --------------------------------------------------------------------
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in." as string | null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin"].includes(profile.role)) return { supabase, error: "Admin only." };
  return { supabase, error: null };
}

export interface ShippingRateInput {
  route_key: string;
  origin_port?: string | null;
  destination_port?: string | null;
  method: string;
  base_price_eur: number;
  rate_pct?: number | null;
  transit_days_min?: number | null;
  transit_days_max?: number | null;
  active?: boolean;
  notes?: string | null;
  sort_order?: number;
}

export async function saveShippingRateAction(input: ShippingRateInput): Promise<SettingsResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  if (!input.route_key?.trim() || !input.method?.trim()) {
    return { ok: false, error: "Route key and method are required." };
  }
  const { error } = await supabase.from("shipping_rates").upsert({
    route_key:        input.route_key.trim(),
    origin_port:      input.origin_port ?? null,
    destination_port: input.destination_port ?? null,
    method:           input.method.trim(),
    base_price_eur:   Number(input.base_price_eur) || 0,
    rate_pct:         input.rate_pct ?? null,
    transit_days_min: input.transit_days_min ?? null,
    transit_days_max: input.transit_days_max ?? null,
    active:           input.active ?? true,
    notes:            input.notes ?? null,
    sort_order:       input.sort_order ?? 100,
    last_verified:    new Date().toISOString().slice(0, 10),
    updated_at:       new Date().toISOString(),
  }, { onConflict: "route_key" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function toggleShippingRateAction(routeKey: string, active: boolean): Promise<SettingsResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  const { error } = await supabase
    .from("shipping_rates")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("route_key", routeKey);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}
