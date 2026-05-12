"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface WatchlistResult {
  ok: boolean;
  watching?: boolean;
  error?: string;
}

export async function toggleWatchlistAction(
  vehicleId: string,
): Promise<WatchlistResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to use your watchlist." };

  const { data: existing } = await supabase
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("vehicle_id", vehicleId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/watchlist");
    return { ok: true, watching: false };
  } else {
    const { error } = await supabase
      .from("watchlist")
      .insert({ user_id: user.id, vehicle_id: vehicleId });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/watchlist");
    return { ok: true, watching: true };
  }
}

export async function removeFromWatchlistAction(
  vehicleId: string,
): Promise<WatchlistResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("vehicle_id", vehicleId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/watchlist");
  return { ok: true, watching: false };
}
