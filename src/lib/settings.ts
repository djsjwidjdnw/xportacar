import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AppSettings {
  landingMode: boolean;
  countdownTarget: string | null; // ISO datetime, or null when unset
}

// Reads the public app_settings used by the homepage. Degrades gracefully:
// if the table doesn't exist yet (migration 025 not applied) or the read fails,
// returns landingMode=false so the live site keeps showing the normal homepage.
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["landing_mode_enabled", "launch_countdown_target"]);
    if (error || !data) return { landingMode: false, countdownTarget: null };
    const map = new Map((data as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
    const target = map.get("launch_countdown_target");
    return {
      landingMode: map.get("landing_mode_enabled") === true,
      countdownTarget: typeof target === "string" && target ? target : null,
    };
  } catch {
    return { landingMode: false, countdownTarget: null };
  }
}
