import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export interface AppSettings {
  landingMode: boolean;
  countdownTarget: string | null; // ISO datetime, or null when unset
  /**
   * app_settings.bidding_enabled. The platform is a fixed-price marketplace;
   * bidding, auctions and counter-offers stay in the code but render only when
   * this is true. Flipping the row brings them back without a rebuild.
   */
  biddingEnabled: boolean;
}

const DEFAULTS: AppSettings = { landingMode: false, countdownTarget: null, biddingEnabled: false };

// The one shared reader of the public app_settings rows (landing toggle,
// countdown, bidding flag). Degrades gracefully: if the table doesn't exist yet
// or the read fails, it returns the defaults — normal homepage, fixed-price mode.
// Pass `client` where request cookies are unavailable (after() callbacks, crons):
// app_settings is publicly readable, so any client works.
export async function getAppSettings(client?: SupabaseClient): Promise<AppSettings> {
  try {
    const supabase = client ?? (await createClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["landing_mode_enabled", "launch_countdown_target", "bidding_enabled"]);
    if (error || !data) return DEFAULTS;
    const map = new Map((data as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
    const target = map.get("launch_countdown_target");
    return {
      landingMode: map.get("landing_mode_enabled") === true,
      countdownTarget: typeof target === "string" && target ? target : null,
      biddingEnabled: map.get("bidding_enabled") === true,
    };
  } catch {
    return DEFAULTS;
  }
}
