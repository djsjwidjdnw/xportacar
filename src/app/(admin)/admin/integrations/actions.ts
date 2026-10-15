"use server";

// Admin Integrations page: the market-prices master switch and the Apify actor.
// Keys are NOT written here: the key fields call admin_set_market_price_key()
// straight from the browser with the admin's session, so a key never passes
// through this server.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface IntegrationResult {
  ok: boolean;
  error?: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (!role || !["admin", "superadmin"].includes(role)) return { supabase, user: null, error: "Admin only." };
  return { supabase, user, error: null };
}

/** Switch market prices on or off. The database refuses "on" while any key is missing. */
export async function setMarketPricesEnabledAction(enabled: boolean): Promise<IntegrationResult> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { ok: false, error: error ?? "Admin only." };
  const { error: e } = await supabase.from("app_settings").upsert(
    { key: "market_prices_enabled", value: enabled, updated_at: new Date().toISOString(), updated_by: user.id },
    { onConflict: "key" },
  );
  if (e) {
    return {
      ok: false,
      error: /MARKET_PRICES_KEYS_MISSING/.test(e.message)
        ? "Add all three keys first: the Vincario API key, the Vincario secret key and the Apify token."
        : e.message,
    };
  }
  revalidatePath("/admin/integrations");
  return { ok: true };
}

const ACTOR_RE = /^[A-Za-z0-9_.-]+([/~][A-Za-z0-9_.-]+)?$/;

/** The Apify Store actor that scrapes Dubizzle Motors, e.g. "memo23/dubizzle-search-listing-s-scraper". */
export async function setApifyActorAction(actor: string): Promise<IntegrationResult> {
  const { supabase, user, error } = await requireAdmin();
  if (error || !user) return { ok: false, error: error ?? "Admin only." };
  const value = actor.trim();
  if (!ACTOR_RE.test(value)) return { ok: false, error: "Use the actor's id, like memo23/dubizzle-search-listing-s-scraper." };
  const { error: e } = await supabase.from("app_settings").upsert(
    { key: "market_prices_apify_actor", value, updated_at: new Date().toISOString(), updated_by: user.id },
    { onConflict: "key" },
  );
  if (e) return { ok: false, error: e.message };
  revalidatePath("/admin/integrations");
  return { ok: true };
}
